/**
 * Auto-detects the PDF format and dispatches to the correct parser.
 * Pages are extracted exactly once to avoid ArrayBuffer detachment issues.
 *
 * Detection order (first match wins):
 *   1. Sailwave    – page-1 item with text "crewname" (case-insensitive)
 *   2. SailResults – page-1 item with text "flight"
 *   3. Velaware    – page-1 item with text "punti" (Italian scoring)
 *   4. unknown     – tries all parsers and returns first with entries
 */

import type { ParsedEntry, ParsedRegatta } from "./manage2sail-paste";
import { extractPageItems } from "./pdf-utils";
import type { RawItem } from "./pdf-utils";

/**
 * Returns true for German entries.
 *
 * Logic:
 *  - Sail number starts with a 2-3 letter NAT code followed by a digit → only
 *    keep "GER …" entries.
 *  - No NAT prefix (pure digits, e.g. domestic regatta) → keep (assume German).
 *
 * Examples that pass:  "GER 12345", "12345", null
 * Examples that fail:  "ESP 55249", "GRE 1234"
 */
function isGermanEntry(entry: ParsedEntry): boolean {
  const sn = (entry.sailNumber ?? "").trim();
  const m = sn.match(/^([A-Z]{2,3})\s+\d/);
  if (!m) return true; // no NAT prefix → domestic regatta → include
  return m[1] === "GER";
}

function filterGerman(regatta: ParsedRegatta): ParsedRegatta {
  const entries = regatta.entries.filter(isGermanEntry);
  const numRaces =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.raceScores.length))
      : 0;
  return { entries, numRaces, totalStarters: entries.length };
}

export type PdfFormat =
  | "sailwave"
  | "sailresults"
  | "velaware"
  | "unknown";

/**
 * Detect the PDF format from page-1 text items.
 */
export function detectPdfFormat(page1Texts: string[]): PdfFormat {
  const set = new Set(page1Texts.map((t) => t.toLowerCase()));
  if (set.has("crewname")) return "sailwave";
  if (set.has("flight")) return "sailresults";
  if (set.has("punti")) return "velaware";
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
  const page1Texts = (pages[0] ?? []).map((it: RawItem) => it.str);
  const format = detectPdfFormat(page1Texts);

  let result: ParsedRegatta | null = null;

  if (format === "sailwave") {
    const { parsePages } = await import("./sailwave-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "sailresults") {
    const { parsePages } = await import("./sailresults-pdf");
    result = filterGerman(parsePages(pages));
  } else if (format === "velaware") {
    const { parsePages } = await import("./velaware-pdf");
    result = filterGerman(parsePages(pages));
  } else {
    // Unknown format: try all parsers and take the first with entries
    const parsers = [
      () => import("./sailwave-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./sailresults-pdf").then((m) => filterGerman(m.parsePages(pages))),
      () => import("./velaware-pdf").then((m) => filterGerman(m.parsePages(pages))),
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
      "Keine Ergebnisse im PDF gefunden (oder keine deutschen Teilnehmer). Unterstützte Formate: Velaware, SailResults (Carnival), Sailwave."
    );
  }

  return { format, result };
}
