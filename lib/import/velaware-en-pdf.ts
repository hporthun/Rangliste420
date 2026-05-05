/**
 * Parser for Velaware Results PDFs with **English** column headers.
 *
 * Format detected by: header row containing "Helmsman", "Crew" AND "Netto".
 * (The Italian Velaware variant uses "Nome" + "Punti" — see velaware-pdf.ts.)
 *
 * Column layout (based on the "5 Lupo Cup 420" PDF from Circolo Vela Torbole):
 *   Rank | nat | sailno | Helmsman | Crew | birthdate | m/f | club | R1 … Rn | Netto
 *
 * Quirks:
 *  - Rank has a degree suffix: "1°", "32°", "100°".
 *  - `nat` and `sailno` are TWO separate columns (unlike Italian Velaware,
 *    where the 3-letter NAT code shares one cell with the digits).
 *  - Helm and Crew are TWO separate columns (unlike Italian Velaware, where
 *    helm + crew + club share a single comma-separated "Nome" cell).
 *  - Race columns are headed "R1", "R2", … (Italian Velaware uses bare "1",
 *    "2", …).
 *  - Multi-line cells: surnames wrap to a second row (`Michalis` /
 *    `Papadakis`), club wraps over 2–3 rows (`NAUTICAL CLUB` / `OF PALEON` /
 *    `FALIRON`), and discarded penalties split across rows
 *    (`(52.0` on the score row, `ufd)` on the wrap row).
 *  - The `birthdate` and `m/f` columns are present but currently ignored —
 *    the wizard treats Sailor stammdaten as admin-pflege only (CLAUDE.md:
 *    "Geburtsdatum/Geschlecht nicht erraten — bleiben leer").
 */

import type {
  ParsedEntry,
  ParsedRaceScore,
  ParsedRegatta,
} from "./manage2sail-paste";
import {
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

/** Rank with optional ° suffix: "1", "1°", "100°". */
const RANK_RE = /^\d+°?$/;

export function isVelawareEnHeader(row: RawItem[]): boolean {
  const lc = new Set(row.map((it) => it.str.toLowerCase()));
  return lc.has("helmsman") && lc.has("crew") && lc.has("netto");
}

function findHeaderRow(rows: RawItem[][]): RawItem[] | null {
  for (const row of rows) {
    if (isVelawareEnHeader(row)) return row;
  }
  return null;
}

function buildColDefs(header: RawItem[]): ColDef[] {
  const cols: Array<{ name: string; x: number }> = [];
  const sorted = [...header].sort((a, b) => a.x - b.x);

  let raceIdx = 0;
  for (const item of sorted) {
    const lc = item.str.toLowerCase().trim();
    if (lc === "rank" || lc === "pos") {
      cols.push({ name: "rank", x: item.x });
    } else if (lc === "nat") {
      cols.push({ name: "nat", x: item.x });
    } else if (lc === "sailno" || lc === "sail" || lc === "sail no") {
      cols.push({ name: "sail", x: item.x });
    } else if (lc === "helmsman" || lc === "helm") {
      cols.push({ name: "helm", x: item.x });
    } else if (lc === "crew") {
      cols.push({ name: "crew", x: item.x });
    } else if (lc === "birthdate") {
      cols.push({ name: "birthdate", x: item.x });
    } else if (lc === "m/f") {
      cols.push({ name: "mf", x: item.x });
    } else if (lc === "club") {
      cols.push({ name: "club", x: item.x });
    } else if (lc === "netto") {
      cols.push({ name: "netto", x: item.x });
    } else if (/^r\d+$/i.test(item.str)) {
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
  const rankXMax = rankCol?.xEnd ?? 50;

  // Group rows into entry blocks: each block starts at a rank marker
  // (e.g. "1°", "100°"). All wrap rows that follow without a new rank
  // marker belong to the same entry.
  const entryBlocks: RawItem[][] = [];
  let current: RawItem[] = [];

  for (const row of dataRows) {
    const rankItem = row.find(
      (it) =>
        it.x >= rankXMin && it.x < rankXMax && RANK_RE.test(it.str)
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
    const rankText = colText(items, "rank", cols).replace(/°/g, "").trim();
    const rank = parseInt(rankText, 10);
    if (isNaN(rank)) continue;

    // sail number: digits in the "sail" column, NAT code in the "nat" column
    const natRaw = colText(items, "nat", cols).trim().toUpperCase();
    const nationality = /^[A-Z]{2,3}$/.test(natRaw) ? natRaw : undefined;
    const sailDigits = colText(items, "sail", cols).trim();
    const sailNumber = sailDigits
      ? nationality
        ? `${nationality} ${sailDigits}`
        : sailDigits
      : nationality ?? null;

    const helmRaw = colText(items, "helm", cols);
    const crewRaw = colText(items, "crew", cols);
    if (!helmRaw) continue;
    const helm = parseSailingName(helmRaw);
    if (!helm.lastName && !helm.firstName) continue;
    const crew = parseSailingName(crewRaw);

    const club = colText(items, "club", cols) || null;

    const nettoText = colText(items, "netto", cols);
    const netPoints = nettoText ? parseDecimal(nettoText) : null;

    const raceScores: ParsedRaceScore[] = [];
    for (let r = 1; r <= numRaceCols; r++) {
      const cellItems = colItems(items, `race_${r}`, cols);
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
      totalPoints: null, // Velaware shows only net total
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
