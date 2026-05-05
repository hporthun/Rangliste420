/**
 * Auto-detects the PDF format and dispatches to the correct parser.
 * Pages are extracted exactly once to avoid ArrayBuffer detachment issues.
 *
 * Detection order (first match wins):
 *   1. Sailwave2   – page-1 item matching /^crewman\s*[12]/i ("Crewman 1 Name" format)
 *   2. Sailwave    – page-1 item with text "crewname" (case-insensitive)
 *   3. SailResults – page-1 item with text "flight"
 *   4. Velaware    – page-1 item with text "punti" (Italian scoring)
 *   5. Velaware EN – page-1 items "helmsman" + "crew" + "netto" (English variant)
 *   6. unknown     – tries all parsers and returns first with entries
 */

import type { ParsedEntry, ParsedRegatta } from "./manage2sail-paste";
import { extractPageItems } from "./pdf-utils";
import type { RawItem } from "./pdf-utils";

/**
 * Returns true for German entries.
 *
 * Logic:
 *  - Prefer the explicit `nationality` field (set by parsers when they can
 *    identify the NAT code); accept GER, reject anything else.
 *  - Fall back to scanning the sail number for a NAT prefix.
 *  - No NAT signal at all (pure digits, null) → keep (assume German).
 */
function isGermanEntry(entry: ParsedEntry): boolean {
  if (entry.nationality) return entry.nationality === "GER";
  const sn = (entry.sailNumber ?? "").trim();
  const m = sn.match(/^([A-Z]{2,3})\s+\d/);
  if (!m) return true; // no NAT prefix → domestic regatta → include
  return m[1] === "GER";
}

export function filterGerman(regatta: ParsedRegatta): ParsedRegatta {
  // totalStarters muss die Gesamtteilnehmerzahl sein (s in der DSV-Formel),
  // also VOR dem Nationalitäten-Filter. Siehe docs/business-rules.md §3.4 + §4.1
  // sowie Issue #55.
  const totalStarters = regatta.entries.length;
  const entries = regatta.entries.filter(isGermanEntry);
  const numRaces =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.raceScores.length))
      : 0;
  return { entries, numRaces, totalStarters };
}

export type PdfFormat =
  | "sailwave2"
  | "sailwave"
  | "sailresults"
  | "velaware"
  | "velaware-en"
  | "unknown";

/**
 * Detect the PDF format from page-1 text items.
 */
export function detectPdfFormat(page1Texts: string[]): PdfFormat {
  // Sailwave 2.38+ uses "Crewman 1 Name" / "Crewman 2 Name" column headers
  if (page1Texts.some((t) => /^crewman\s*[12]/i.test(t))) return "sailwave2";
  const set = new Set(page1Texts.map((t) => t.toLowerCase()));
  if (set.has("crewname")) return "sailwave";
  if (set.has("flight")) return "sailresults";
  if (set.has("punti")) return "velaware";
  // English Velaware export (e.g. Circolo Vela Torbole "Lupo Cup"): the
  // "punti" header is replaced by "Netto", and helm/crew sit in their own
  // columns. Distinct enough to detect by "Helmsman" + "Netto".
  if (set.has("helmsman") && set.has("netto")) return "velaware-en";
  return "unknown";
}

/**
 * Parse a PDF buffer, auto-detecting the format.
 * Page items are extracted exactly once; parsers receive the pre-extracted pages.
 */
export async function parsePdf(
  buffer: ArrayBuffer | Uint8Array
): Promise<{ format: PdfFormat; result: ParsedRegatta }> {
  // Extract all pages once (pdfjs may detach the ArrayBuffer after this call)
  const pages = await extractPageItems(buffer);

  // Image-only PDF (e.g. scanned or rasterized): pdfjs returns 0 text items
  // on every page. Detect this up front so we can give a useful hint instead
  // of the generic "no entries found" later.
  if (pages.length > 0 && pages.every((p) => p.length === 0)) {
    throw new Error(
      'Diese PDF enthält keine Textebene - sie besteht nur aus eingebetteten Bildern (z. B. nach Scan oder Rasterisierung beim Druck). Bitte vorher per OCR (Adobe Acrobat: "Scan & OCR" / "Texterkennung", oder Online-Tools wie ilovepdf.com/ocr-pdf) in eine durchsuchbare PDF umwandeln und dann erneut importieren.'
    );
  }

  const page1Texts = (pages[0] ?? []).map((it: RawItem) => it.str);
  const format = detectPdfFormat(page1Texts);

  let result: ParsedRegatta | null = null;

  if (format === "sailwave2") {
    const { parsePages } = await import("./sailwave2-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "sailwave") {
    const { parsePages } = await import("./sailwave-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "sailresults") {
    const { parsePages } = await import("./sailresults-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "velaware") {
    const { parsePages } = await import("./velaware-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "velaware-en") {
    const { parsePages } = await import("./velaware-en-pdf");
    result = filterGerman(parsePages(pages));
  } else {
    // Unknown format: try all parsers and take the first with entries
    const parsers = [
      () => import("./sailwave2-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./sailwave-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./sailresults-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./velaware-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./velaware-en-pdf").then((m) => filterGerman(m.parsePages(pages))),
    ];
    for (const tryParser of parsers) {
      try {
        const r = await tryParser();
        if (r.entries.length > 0) {
          result = r;
          break;
        }
      } catch {
        // try next
      }
    }
  }

  if (!result || result.entries.length === 0) {
    throw new Error(
      "Keine Ergebnisse im PDF gefunden (oder keine deutschen Teilnehmer). Unterstützte Formate: Velaware (IT/EN), SailResults (Carnival), Sailwave, Sailwave 2.38+."
    );
  }

  return { format, result };
}
