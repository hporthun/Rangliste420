/**
 * Shared utilities for PDF result parsers.
 * All parsers follow the same column-based strategy:
 *   1. Group text items into rows by Y-coordinate
 *   2. Detect header row by format-specific keywords → derive column X ranges
 *   3. Scan data rows for rank markers → accumulate items per entry
 *   4. For each entry, assign items to columns and join cell text
 *
 * Multi-line cells (e.g. "(56.0\nDNC)") are handled naturally: since items of the
 * same cell are in the same column X band and the same entry block (no rank marker
 * between them), they get collected together and joined before parsing.
 */

import type { ParsedRaceScore } from "./manage2sail-paste";

export const PENALTY_CODES_SET = new Set([
  "DNC", "DNS", "DNF", "DSQ", "BFD", "OCS", "RET", "WFD",
  "UFD", "SCP", "TLE", "OOD", "DGM", "ZFP", "RDG", "DNE",
]);

export type RawItem = { str: string; x: number; y: number };

/**
 * Groups items by approximate Y (within tolerance px).
 * Returns rows sorted descending Y (higher Y = top of page = first in list).
 */
export function groupByRow(items: RawItem[], tolerance = 4): RawItem[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: RawItem[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const row = rows[rows.length - 1];
    if (Math.abs(sorted[i].y - row[0].y) <= tolerance) {
      row.push(sorted[i]);
    } else {
      rows.push([sorted[i]]);
    }
  }
  return rows;
}

/**
 * Pre-load the pdfjs worker into `globalThis.pdfjsWorker` so that
 * `_setupFakeWorkerGlobal` (in pdfjs-dist) skips its problematic dynamic
 * `import(workerSrc)` call.
 *
 * Why this is necessary:
 *
 *   - pdfjs-dist v5 in Node.js sets `workerSrc = "./pdf.worker.mjs"` and then
 *     does `await import(workerSrc)` lazily. Next.js Turbopack rewrites the
 *     `import.meta.url` of external packages to a synthetic `[project]/…`
 *     URL, so the relative resolution produces a non-existent package name
 *     → "Cannot find package '[project]'".
 *   - On Vercel the same dynamic import was failing earlier because nft did
 *     not include `pdf.worker.mjs` in the deployment bundle.
 *
 * pdfjs-dist already provides an opt-out path for both cases: if
 * `globalThis.pdfjsWorker?.WorkerMessageHandler` is set when the loader
 * runs, the dynamic import is skipped and the cached handler is used.
 *
 * We resolve the static import of `pdf.worker.mjs` here. Statically
 * importing it makes webpack/turbopack/nft trace the dependency, so the
 * file is included in the bundle automatically (this also makes the
 * `outputFileTracingIncludes` entry in `next.config.ts` redundant, but
 * harmless to keep as belt-and-braces).
 */
let workerInitialized = false;
async function ensureWorker(): Promise<void> {
  if (workerInitialized) return;
  type WorkerHolder = { pdfjsWorker?: { WorkerMessageHandler: unknown } };
  const g = globalThis as unknown as WorkerHolder;
  if (!g.pdfjsWorker) {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    g.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
  }
  workerInitialized = true;
}

/**
 * Repariert Mojibake, das pdfjs bei manchen PDFs erzeugt: dort werden Bytes
 * eines UTF-8-encodierten Strings als Latin-1/CP1252-Codepoints zurueckgegeben.
 * Beispiel: "Grünau" → "GrÃ¼nau". Bei zweifachem Encoding-Fehler entstehen
 * Drei-Byte-Sequenzen wie "TÃƒÂ³th" (eigentlich "Tóth").
 *
 * Strategie: Codepoints in CP1252-Bytes zuruecklatten und als UTF-8 dekodieren.
 * Wiederhole bis zu zweimal, da manche PDFs zwei Mojibake-Schichten haben.
 * Bricht ab, sobald TextDecoder mit fatal=true scheitert (Eingabe ist dann
 * bereits korrektes UTF-8 und sollte nicht angefasst werden).
 *
 * Issue #66.
 */
const CP1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function tryDecodeOnce(s: string): string | null {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i);
    if (cp <= 0xff) {
      bytes[i] = cp;
    } else if (cp in CP1252_REVERSE) {
      bytes[i] = CP1252_REVERSE[cp];
    } else {
      return null;
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function fixDoubleEncodedUtf8(s: string): string {
  if (!s || !/[ÃÅÂƒ]/.test(s)) return s;
  let current = s;
  for (let i = 0; i < 2; i++) {
    const next = tryDecodeOnce(current);
    if (next === null || next === current) break;
    current = next;
    if (!/[ÃÅÂƒ]/.test(current)) break;
  }
  return current;
}

/** Extract text items from every page. Returns one item list per page. */
export async function extractPageItems(
  buffer: ArrayBuffer | Uint8Array
): Promise<RawItem[][]> {
  await ensureWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // isEvalSupported entfaellt seit pdfjs-dist 5.7 — eval ist standardmaessig
  // deaktiviert, der Parameter wurde aus den Types entfernt.
  const doc = await pdfjs
    .getDocument({ data, useWorkerFetch: false })
    .promise;
  const pages: RawItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: RawItem[] = [];
    for (const item of tc.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      items.push({
        str: fixDoubleEncodedUtf8(item.str.trim()),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      });
    }
    pages.push(items);
  }
  return pages;
}

/** Parse a number that may use comma (Italian) or dot as decimal separator. */
export function parseDecimal(s: string): number {
  return parseFloat(s.replace(",", ".").trim());
}

/**
 * Race-Codes, fuer die wir defaultmaessig "Boot kam ins Startgebiet"
 * vorschlagen — siehe docs/business-rules.md §2.1 + Issue #60:
 *
 *   - OCS / BFD / UFD: Frühstart-DSQs (RRS A11). Boot war definitiv im
 *     Startgebiet (sonst kein OCS/BFD/UFD moeglich).
 *   - DNS: "Did Not Start". Wir behandeln das defensiv als "im
 *     Startgebiet" — viele Auswertungen markieren so Boote, die
 *     erschienen sind aber nicht ueber die Linie kamen. Der Admin
 *     kann den Default im Wizard pro Eintrag toggeln.
 *
 * Single source of truth: alle Parser und der Import-Wizard
 * (components/import-wizard/startarea-step.tsx) importieren genau
 * diese Konstante / detectInStartArea-Helper.
 */
export const IN_START_AREA_CODES = new Set(["DNS", "BFD", "OCS", "UFD"]);

/** Suggest inStartArea based on penalty codes in race scores. */
export function detectInStartArea(scores: ParsedRaceScore[]): boolean {
  return scores.some((s) =>
    IN_START_AREA_CODES.has((s.code ?? "").toUpperCase())
  );
}

/**
 * Parse a sailing name string into { firstName, lastName }.
 * Handles:
 *   "Firstname LASTNAME"  – all-caps word(s) are the surname
 *   "LASTNAME, Firstname" – comma-separated, surname first
 *   "Firstname Lastname"  – no all-caps: first word → firstName, rest → lastName
 */
export function parseSailingName(raw: string): {
  firstName: string;
  lastName: string;
} {
  const s = raw.trim();
  if (!s) return { firstName: "", lastName: "" };

  // "LAST, First" comma format
  if (s.includes(",")) {
    const idx = s.indexOf(",");
    return {
      lastName: s.slice(0, idx).trim(),
      firstName: s.slice(idx + 1).trim(),
    };
  }

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };

  // Find first all-uppercase-alpha-only word (minimum 2 chars to avoid "M", "F")
  let lastNameStart = -1;
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (
      w.length >= 2 &&
      w === w.toUpperCase() &&
      /^[A-ZÄÖÜ\-']+$/.test(w)
    ) {
      lastNameStart = i;
      break;
    }
  }

  if (lastNameStart === 0) {
    // Collect consecutive all-caps words as last name
    const lastParts: string[] = [];
    let i = 0;
    while (
      i < parts.length &&
      parts[i] === parts[i].toUpperCase() &&
      /^[A-ZÄÖÜ\-']+$/.test(parts[i])
    ) {
      lastParts.push(parts[i]);
      i++;
    }
    return { firstName: parts.slice(i).join(" "), lastName: lastParts.join(" ") };
  }

  if (lastNameStart > 0) {
    return {
      firstName: parts.slice(0, lastNameStart).join(" "),
      lastName: parts.slice(lastNameStart).join(" "),
    };
  }

  // No all-caps found: first word = first name, rest = last name (title-case heuristic)
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** A horizontal band in the PDF corresponding to one logical column. */
export type ColDef = { name: string; xStart: number; xEnd: number };

/**
 * Build column definitions from a list of (name, centerX) pairs.
 * Boundaries are placed at midpoints between consecutive column centres,
 * which is robust against varying text widths (e.g. "(29)" vs "4").
 */
export function makeColDefs(
  cols: Array<{ name: string; x: number }>
): ColDef[] {
  const sorted = [...cols].sort((a, b) => a.x - b.x);
  return sorted.map((col, i) => {
    const prevX = i > 0 ? sorted[i - 1].x : col.x - 50;
    const nextX = i < sorted.length - 1 ? sorted[i + 1].x : col.x + 50;
    return {
      name: col.name,
      xStart: Math.round((prevX + col.x) / 2),
      xEnd: Math.round((col.x + nextX) / 2),
    };
  });
}

/** Returns which column an item belongs to, or null if outside all columns. */
export function assignCol(item: RawItem, cols: ColDef[]): string | null {
  for (const col of cols) {
    if (item.x >= col.xStart && item.x < col.xEnd) return col.name;
  }
  return null;
}

/**
 * Collect items from `items` that fall in the named column,
 * sorted top-to-bottom (descending Y = reading order in PDF).
 */
export function colItems(
  items: RawItem[],
  colName: string,
  cols: ColDef[]
): RawItem[] {
  return items
    .filter((it) => assignCol(it, cols) === colName)
    .sort((a, b) => b.y - a.y);
}

/** Join items in a column into a single space-separated string (reading order). */
export function colText(
  items: RawItem[],
  colName: string,
  cols: ColDef[]
): string {
  return colItems(items, colName, cols)
    .map((it) => it.str)
    .join(" ")
    .trim();
}

/**
 * Parse a score cell string (possibly assembled from multiple PDF text items).
 *
 * Supported notations:
 *   "5.0"              → plain score
 *   "18"               → integer score (Velaware)
 *   "(3.0)"            → discarded score
 *   "(56.0 DNC)"       → discarded penalty  (Sailwave: "(56.0" + "DNC)")
 *   "[22.0]"           → discarded score    (SailResults)
 *   "[66.0 BFD]"       → discarded penalty  (SailResults: "[66.0" + "BFD]")
 *   "(29)"             → integer discard    (Velaware)
 *   "ufd" / "DNC"      → penalty code only
 *   "(ufd)"            → discarded penalty  (Velaware)
 *   "25.0 RDG"         → score with redress code
 *
 * Returns null if the string is not parseable as a score.
 */
export function parseScoreCell(raw: string): {
  points: number;
  isDiscard: boolean;
  code?: string;
} | null {
  const s = raw.trim();
  if (!s) return null;

  const isDiscardParen = s.startsWith("(");
  const isDiscardBracket = s.startsWith("[");
  const isDiscard = isDiscardParen || isDiscardBracket;

  // Strip outermost bracket/paren (handles "(56.0 DNC)" and "[66.0 BFD]")
  const inner = s.replace(/^[\[(]/, "").replace(/[\])]$/, "").trim();
  const parts = inner.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  // Pure penalty code (no number)
  const first = parts[0].toUpperCase();
  if (PENALTY_CODES_SET.has(first) && parts.length === 1) {
    return { points: 0, isDiscard, code: first };
  }

  // Number (with optional trailing penalty code)
  const numStr = parts[0].replace(",", ".");
  const points = parseFloat(numStr);
  if (isNaN(points)) return null;

  const lastPart = parts[parts.length - 1].toUpperCase();
  const validCode =
    parts.length > 1 && PENALTY_CODES_SET.has(lastPart) ? lastPart : undefined;

  return { points, isDiscard, code: validCode };
}
