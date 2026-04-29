/**
 * Parser for Velaware Results PDFs (Italian sailing software).
 *
 * Format detected by: header row containing both "Nome" and "Punti".
 * Column layout: Nº | Numero velico | Nome | Punti | 1 | 2 | 3 | …
 *
 * Quirks:
 *  - Rank: plain integer (no ° suffix)
 *  - Sail: NAT code + number in the "Numero velico" column  ("ESP 55249")
 *  - Nome: "Helm Name, Crew Name, Club, …" comma-separated in a single cell
 *  - Net points: Italian comma decimal ("63,0")
 *  - Scores: integers; "(29)" = discard; "ufd"/"bfd"/"dnc" = penalty code (lowercase)
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

/** Detect the Velaware header row: contains "Nome" AND "Punti". */
function findHeaderRow(rows: RawItem[][]): RawItem[] | null {
  for (const row of rows) {
    const lc = new Set(row.map((it) => it.str.toLowerCase()));
    if (lc.has("nome") && lc.has("punti")) return row;
  }
  return null;
}

/**
 * Build column definitions from the Velaware header row.
 * The rank column is matched by the "Nº" / "N°" ordinal marker at the leftmost position.
 * If the marker isn't recognised, the leftmost item is assumed to be rank.
 */
function buildColDefs(header: RawItem[]): ColDef[] {
  const cols: Array<{ name: string; x: number }> = [];

  // Sort header items left-to-right
  const sorted = [...header].sort((a, b) => a.x - b.x);

  let raceIdx = 0;
  for (const item of sorted) {
    const lc = item.str.toLowerCase().trim();

    if (/^n[º°ÿo]?$/.test(lc) || lc === "pos") {
      cols.push({ name: "rank", x: item.x });
    } else if (lc.includes("numero") || lc.includes("velico")) {
      cols.push({ name: "sailvelico", x: item.x });
    } else if (lc === "nome") {
      cols.push({ name: "nome", x: item.x });
    } else if (lc === "punti") {
      cols.push({ name: "punti", x: item.x });
    } else if (/^\d+$/.test(item.str)) {
      // Race column header (plain integer like "1", "2", …)
      raceIdx++;
      cols.push({ name: `race_${raceIdx}`, x: item.x });
    }
  }

  // If rank column wasn't matched by keyword, use the leftmost item
  if (!cols.some((c) => c.name === "rank") && sorted.length > 0) {
    cols.push({ name: "rank", x: sorted[0].x });
  }

  return makeColDefs(cols);
}

function parsePage(pageItems: RawItem[]): ParsedEntry[] {
  const rows = groupByRow(pageItems, 4);
  const header = findHeaderRow(rows);
  if (!header) return [];

  const cols = buildColDefs(header);
  const numRaceCols = cols.filter((c) => c.name.startsWith("race_")).length;
  if (!cols.some((c) => c.name === "nome") || numRaceCols === 0) return [];

  const headerY = Math.max(...header.map((it) => it.y));

  // Data rows: those whose top item is below the header in PDF space (lower Y value)
  const dataRows = rows.filter((row) => row[0].y < headerY);

  // Find rank column bounds (used to detect new entry starts)
  const rankCol = cols.find((c) => c.name === "rank");
  const rankXMin = rankCol?.xStart ?? 0;
  const rankXMax = rankCol?.xEnd ?? 30;
  const RANK_RE = /^\d+$/;

  // Accumulate rows into entry blocks, split by rank marker
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
    const rankText = colText(items, "rank", cols);
    const rank = parseInt(rankText, 10);
    if (isNaN(rank)) continue;

    // Sail number: NAT code + number from the velico column, joined
    const sailItems = colItems(items, "sailvelico", cols);
    const sailRaw = sailItems.map((it) => it.str).join(" ").trim();
    const sailNumber = sailRaw || null;

    // Nome: "Helm Name, Crew Name, Club, …"
    const nomeRaw = colText(items, "nome", cols);
    // Split on ", " – first part = helm, second = crew, rest = club
    const nomeParts = nomeRaw.split(/, /);
    const helmRaw = nomeParts[0]?.trim() ?? "";
    const crewRaw = nomeParts[1]?.trim() ?? "";
    const clubRaw = nomeParts.slice(2).join(", ").trim() || null;

    // Require at least a non-empty nome to skip footer/title rows
    if (!helmRaw) continue;
    const helm = parseSailingName(helmRaw);
    if (!helm.lastName && !helm.firstName) continue;
    const crew = parseSailingName(crewRaw);

    // Net points (Velaware shows only net, no gross total)
    const puntiText = colText(items, "punti", cols);
    const netPoints = puntiText ? parseDecimal(puntiText) : null;

    // Race scores
    const raceScores: ParsedRaceScore[] = [];
    for (let r = 1; r <= numRaceCols; r++) {
      const cellItems = colItems(items, `race_${r}`, cols);
      // Join parts to reconstruct multi-line cells (rare in Velaware, but safe)
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
      club: clubRaw,
      totalPoints: null, // Velaware only shows net total
      netPoints,
      raceScores,
      inStartAreaSuggestion: detectInStartArea(raceScores),
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
