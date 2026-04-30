/**
 * Parser for Sailwave Results PDFs (common regatta scoring software).
 *
 * Format detected by: header row containing both "sailno" AND "CrewName" (case-insensitive).
 *
 * Column layout:
 *   Rank | nat | sailno | name | CrewName | club | Divisione | m/f | R1…Rn | Totale | Netto
 *
 * Quirks:
 *  - Rank: "1°", "2°", … (ordinal suffix)
 *  - Long names / clubs may wrap to a second PDF line within the same entry block
 *    (e.g. "Theda-Marieke\nBruhns", "JK Pirat\nPortoroz")
 *  - Scores: floats ("1.0"); discards: "(3.0)"; penalties: "(56.0 DNC)" which may
 *    be split across two PDF lines as "(56.0" + "DNC)"
 *  - Totale (gross) comes BEFORE Netto (net) — reversed vs SailResults!
 *  - Some entries have no club or no Divisione value
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

const RANK_RE = /^\d+°$/;

/**
 * Find the Sailwave header row: contains "sailno" AND "crewname" (case-insensitive).
 */
function findHeaderRow(rows: RawItem[][]): RawItem[] | null {
  for (const row of rows) {
    const lc = new Set(row.map((it) => it.str.toLowerCase()));
    if (lc.has("sailno") && lc.has("crewname")) return row;
  }
  return null;
}

function buildColDefs(header: RawItem[]): ColDef[] {
  const cols: Array<{ name: string; x: number }> = [];
  let raceIdx = 0;

  for (const item of [...header].sort((a, b) => a.x - b.x)) {
    const lc = item.str.toLowerCase().trim();

    if (lc === "rank") cols.push({ name: "rank", x: item.x });
    else if (lc === "nat") cols.push({ name: "nat", x: item.x });
    else if (lc === "sailno") cols.push({ name: "sailno", x: item.x });
    else if (lc === "name") cols.push({ name: "name", x: item.x });
    else if (lc === "crewname") cols.push({ name: "crewname", x: item.x });
    else if (lc === "club") cols.push({ name: "club", x: item.x });
    else if (lc === "divisione") cols.push({ name: "divisione", x: item.x });
    else if (lc === "m/f") cols.push({ name: "mf", x: item.x });
    else if (lc === "totale") cols.push({ name: "totale", x: item.x });
    else if (lc === "netto") cols.push({ name: "netto", x: item.x });
    else if (/^r?\d+$/i.test(item.str)) {
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
  if (!cols.some((c) => c.name === "name") || numRaceCols === 0) return [];

  const headerY = Math.max(...header.map((it) => it.y));
  const dataRows = rows.filter((row) => row[0].y < headerY);

  const rankCol = cols.find((c) => c.name === "rank");
  const rankXMin = rankCol?.xStart ?? 0;
  const rankXMax = rankCol?.xEnd ?? 30;

  // Split into entry blocks at each rank marker
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
    // Prefer plain number; prepend NAT only if useful
    const sailNumber = sailno
      ? nat
        ? `${nat} ${sailno}`
        : sailno
      : null;
    const nationality = /^[A-Z]{2,3}$/.test(nat) ? nat : undefined;

    // Helm name (may wrap: "Theda-Marieke" + "Bruhns" in name col)
    const nameText = colText(items, "name", cols);
    const helm = parseSailingName(nameText);
    if (!helm.lastName && !helm.firstName) continue;

    // Crew name (may wrap: "Kristian" + "Petaros" in crewname col)
    const crewText = colText(items, "crewname", cols);
    const crew = parseSailingName(crewText);

    const club = colText(items, "club", cols) || null;

    // Sailwave column order: Totale (gross) THEN Netto (net)
    const totaleText = colText(items, "totale", cols);
    const nettoText = colText(items, "netto", cols);
    const totalPoints = totaleText ? parseDecimal(totaleText) : null;
    const netPoints = nettoText ? parseDecimal(nettoText) : null;

    // Race scores
    const raceScores: ParsedRaceScore[] = [];
    for (let r = 1; r <= numRaceCols; r++) {
      const cellItems = colItems(items, `race_${r}`, cols);
      // Join top-to-bottom — handles "(56.0" + "DNC)" split across two PDF lines
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
