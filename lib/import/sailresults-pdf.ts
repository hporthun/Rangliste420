/**
 * Parser for SailResults PDFs (used e.g. by 420 Carnival Race).
 *
 * Format detected by: any page-1 item with text "Flight" or "Cat" combined
 * with "Helm" in the same rows.
 *
 * Column layout:
 *   Rank | Bow No | Nat | Sail No | Helm | Crew | Club | Cat | Flight | R1…Rn | Netto | Totale
 *
 * Quirks:
 *  - Rank: "1°", "2°", … (ordinal suffix)
 *  - Header may span two rows ("Bow\nNo", "Sail\nNo" wrap to next line)
 *  - Names may wrap (e.g. "Athanasios\nPapadopoulos")
 *  - Clubs may wrap ("Nautical Club of\nKalamaki")
 *  - Scores: floats ("5.0"); discards: "[22.0]"; penalties: "[66.0 BFD]" (possibly
 *    split across two rows as "[66.0" + "BFD]")
 *  - Netto (net) comes BEFORE Totale (gross) in column order
 */

import type { ParsedEntry, ParsedRaceScore, ParsedRegatta } from "./manage2sail-paste";
import {
  extractPageItems,
  groupByRow,
  parseDecimal,
  detectInStartArea,
  parseSailingName,
  makeColDefs,
  colItems,
  colText,
  parseScoreCell,
  type RawItem,
  type ColDef,
} from "./pdf-utils";

const RANK_RE = /^\d+°$/; // "1°", "12°", …

/**
 * Find the primary header row (contains "Helm" AND "Crew" AND "Flight").
 * The "Bow No" and "Sail No" continuations on the next PDF line are ignored
 * because they get skipped naturally (no rank marker → not accumulated).
 */
function findHeaderRow(rows: RawItem[][]): RawItem[] | null {
  for (const row of rows) {
    const lc = new Set(row.map((it) => it.str.toLowerCase()));
    if (lc.has("helm") && lc.has("crew") && lc.has("flight")) return row;
  }
  // Fallback: look for "Helm" + "Crew" + "Cat"
  for (const row of rows) {
    const lc = new Set(row.map((it) => it.str.toLowerCase()));
    if (lc.has("helm") && lc.has("crew") && lc.has("cat")) return row;
  }
  return null;
}

function buildColDefs(header: RawItem[]): ColDef[] {
  const cols: Array<{ name: string; x: number }> = [];
  let raceIdx = 0;

  for (const item of [...header].sort((a, b) => a.x - b.x)) {
    const lc = item.str.toLowerCase().trim();

    if (lc === "rank") cols.push({ name: "rank", x: item.x });
    else if (lc === "bow") cols.push({ name: "bownumber", x: item.x });
    else if (lc === "nat") cols.push({ name: "nat", x: item.x });
    else if (lc === "sail") cols.push({ name: "sailno", x: item.x });
    else if (lc === "helm") cols.push({ name: "helm", x: item.x });
    else if (lc === "crew") cols.push({ name: "crew", x: item.x });
    else if (lc === "club") cols.push({ name: "club", x: item.x });
    else if (lc === "cat") cols.push({ name: "cat", x: item.x });
    else if (lc === "flight") cols.push({ name: "flight", x: item.x });
    else if (lc === "netto") cols.push({ name: "netto", x: item.x });
    else if (lc === "totale") cols.push({ name: "totale", x: item.x });
    else if (/^r\d+$/i.test(item.str)) {
      raceIdx++;
      cols.push({ name: `race_${raceIdx}`, x: item.x });
    }
  }

  return makeColDefs(cols);
}

function parsePage(pageItems: RawItem[]): ParsedEntry[] {
  const rows = groupByRow(pageItems, 4);
  const header = findHeaderRow(rows);
  if (!header) return [];

  const cols = buildColDefs(header);
  const numRaceCols = cols.filter((c) => c.name.startsWith("race_")).length;
  if (!cols.some((c) => c.name === "helm") || numRaceCols === 0) return [];

  const headerY = Math.max(...header.map((it) => it.y));
  const dataRows = rows.filter((row) => row[0].y < headerY);

  const rankCol = cols.find((c) => c.name === "rank");
  const rankXMin = rankCol?.xStart ?? 0;
  const rankXMax = rankCol?.xEnd ?? 30;

  // Split into entry blocks by rank marker
  const entryBlocks: RawItem[][] = [];
  let current: RawItem[] = [];

  for (const row of dataRows) {
    const rankItem = row.find(
      (it) => it.x >= rankXMin && it.x < rankXMax && RANK_RE.test(it.str)
    );
    if (rankItem) {
      if (current.length) entryBlocks.push(current);
      current = [...row];
    } else if (current.length) {
      current.push(...row);
    }
  }
  if (current.length) entryBlocks.push(current);

  const entries: ParsedEntry[] = [];

  for (const items of entryBlocks) {
    const rankText = colText(items, "rank", cols);
    const rank = parseInt(rankText.replace("°", ""), 10);
    if (isNaN(rank)) continue;

    const nat = colText(items, "nat", cols);
    const sailno = colText(items, "sailno", cols);
    const sailNumber = sailno
      ? nat
        ? `${nat} ${sailno}`
        : sailno
      : null;
    const nationality = /^[A-Z]{2,3}$/.test(nat) ? nat : undefined;

    const helmText = colText(items, "helm", cols);
    const helm = parseSailingName(helmText);
    if (!helm.lastName && !helm.firstName) continue;

    const crewText = colText(items, "crew", cols);
    const crew = parseSailingName(crewText);

    // Club: join any wrapping lines
    const club = colText(items, "club", cols) || null;

    // SailResults: Netto = net points, Totale = gross total
    const nettoText = colText(items, "netto", cols);
    const totaleText = colText(items, "totale", cols);
    const netPoints = nettoText ? parseDecimal(nettoText) : null;
    const totalPoints = totaleText ? parseDecimal(totaleText) : null;

    // Race scores
    const raceScores: ParsedRaceScore[] = [];
    for (let r = 1; r <= numRaceCols; r++) {
      const cellItems = colItems(items, `race_${r}`, cols);
      // Sort top-to-bottom (Y desc) and join — handles "[66.0" + "BFD]" splits
      const cellText = cellItems.map((it) => it.str).join(" ").trim();
      if (!cellText) continue;

      const parsed = parseScoreCell(cellText);
      if (parsed) raceScores.push({ race: r, ...parsed });
    }

    entries.push({
      rank,
      sailNumber,
      helmFirstName: helm.firstName,
      helmLastName: helm.lastName,
      crewFirstName: crew.firstName || null,
      crewLastName: crew.lastName || null,
      club,
      totalPoints,
      netPoints,
      raceScores,
      inStartAreaSuggestion: detectInStartArea(raceScores),
      ...(nationality && { nationality }),
    });
  }

  return entries;
}

/** Parse from already-extracted page items (avoids double pdfjs call). */
export function parsePages(pages: RawItem[][]): ParsedRegatta {
  const allEntries: ParsedEntry[] = [];
  for (const pageItems of pages) {
    allEntries.push(...parsePage(pageItems));
  }
  const numRaces =
    allEntries.length > 0
      ? Math.max(...allEntries.map((e) => e.raceScores.length))
      : 0;
  return { entries: allEntries, numRaces, totalStarters: allEntries.length };
}

export async function parsePdfBuffer(
  buffer: ArrayBuffer | Uint8Array
): Promise<ParsedRegatta> {
  const pages = await extractPageItems(buffer);
  const allEntries: ParsedEntry[] = [];

  for (const pageItems of pages) {
    allEntries.push(...parsePage(pageItems));
  }

  const numRaces =
    allEntries.length > 0
      ? Math.max(...allEntries.map((e) => e.raceScores.length))
      : 0;

  return { entries: allEntries, numRaces, totalStarters: allEntries.length };
}
