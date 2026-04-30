/**
 * Parser for Sailwave 2.38+ PDFs (JZS / "Crewman" column format).
 *
 * Detected by: any page-1 text item matching /^crewman\s*[12]/i.
 *
 * Column layout (wrapped two-line headers):
 *   Rank | Class | Nationality | Sail number | Crewman 1 Name | Crewman 2 Name |
 *   Crewman 1 Gender | Crewman 2 Gender | Crewman 1 Club | Crewman 2 Club |
 *   R1 … Rn | Total | Nett
 *
 * Differences from sailwave-pdf.ts (v1):
 *  - Rank:        "1st", "2nd", "3rd", "Nth" (not "1°")
 *  - NAT:         explicit "Nationality" column with flag image + text (e.g. "SLO")
 *  - Sail number: own column, plain integer (NAT is separate)
 *  - Headers:     wrap across 2 PDF lines → detected by x-proximity grouping
 *  - Scores:      integers (not floats); Total / Nett (not Totale / Netto)
 *  - Codes:       "(55 DNC)" discarded, "55 DNE" non-discarded penalty
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

const RANK_RE = /^\d+(?:st|nd|rd|th)$/i;

/**
 * Group header items by x-proximity (tolerance 8 px) and derive ColDefs.
 *
 * Multi-line headers ("Sail" + "number", "Crewman 1" + "Name") land in the
 * same x-group; their combined text identifies the column.
 */
function buildColDefs(headerItems: RawItem[]): ColDef[] {
  // x-groups: map representative-x → list of texts (sorted top-to-bottom)
  const groups: { x: number; items: RawItem[] }[] = [];

  for (const item of headerItems) {
    const group = groups.find((g) => Math.abs(item.x - g.x) < 8);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ x: item.x, items: [item] });
    }
  }

  const cols: Array<{ name: string; x: number }> = [];
  let raceIdx = 0;

  // Sort groups left-to-right so race columns get sequential indices in order
  const sortedGroups = [...groups].sort((a, b) => a.x - b.x);

  for (const group of sortedGroups) {
    // Sort top-to-bottom (higher y = higher on page in PDF coords)
    const texts = group.items
      .sort((a, b) => b.y - a.y)
      .map((it) => it.str.trim())
      .filter(Boolean);
    const combined = texts.join(" ").toLowerCase();

    if (combined === "rank") {
      cols.push({ name: "rank", x: group.x });
    } else if (combined === "class") {
      // Sentinel: keeps class data out of the nat column
      cols.push({ name: "_class", x: group.x });
    } else if (combined.includes("nationality")) {
      cols.push({ name: "nat", x: group.x });
    } else if (combined.includes("sail") && combined.includes("number")) {
      cols.push({ name: "sailno", x: group.x });
    } else if (combined.includes("crewman 1") && combined.includes("name")) {
      cols.push({ name: "name", x: group.x });
    } else if (combined.includes("crewman 2") && combined.includes("name")) {
      cols.push({ name: "crewname", x: group.x });
    } else if (combined.includes("1 gender")) {
      // Sentinel: keeps gender data out of the crewname column
      cols.push({ name: "_c1gender", x: group.x });
    } else if (combined.includes("2 gender")) {
      // Sentinel: keeps gender data out of the club column
      cols.push({ name: "_c2gender", x: group.x });
    } else if (combined.includes("crewman 1") && combined.includes("club")) {
      cols.push({ name: "club", x: group.x });
    } else if (combined.includes("crewman 2") && combined.includes("club")) {
      // Sentinel: keeps crewman-2 club data out of the race_1 column
      cols.push({ name: "_c2club", x: group.x });
    } else if (combined.includes("total")) {
      cols.push({ name: "totale", x: group.x });
    } else if (combined === "nett" || combined.includes("nett")) {
      cols.push({ name: "netto", x: group.x });
    } else if (/^r\d+$/.test(combined)) {
      raceIdx++;
      cols.push({ name: `race_${raceIdx}`, x: group.x });
    }
  }

  return makeColDefs(cols);
}

/**
 * Find all items belonging to the header area of a page.
 * Strategy: locate the "Rank" item; collect everything within ±20 px vertically.
 */
function findHeaderItems(rows: RawItem[][]): RawItem[] {
  let rankY: number | null = null;
  for (const row of rows) {
    if (row.some((it) => it.str.toLowerCase() === "rank")) {
      rankY = row[0].y;
      break;
    }
  }
  if (rankY === null) return [];

  // Return all items within 20 px of the Rank row (captures wrapped header lines)
  return rows
    .flat()
    .filter((it) => Math.abs(it.y - rankY!) <= 20);
}

function parsePage(pageItems: RawItem[]): ParsedEntry[] {
  const rows = groupByRow(pageItems, 4);
  const headerItems = findHeaderItems(rows);
  if (!headerItems.length) return [];

  const cols = buildColDefs(headerItems);
  const numRaceCols = cols.filter((c) => c.name.startsWith("race_")).length;
  if (!cols.some((c) => c.name === "name") || numRaceCols === 0) return [];

  const headerYMin = Math.min(...headerItems.map((it) => it.y));
  const dataRows = rows.filter((row) => row[0].y < headerYMin);

  const rankCol = cols.find((c) => c.name === "rank");
  const rankXMin = rankCol?.xStart ?? 0;
  const rankXMax = rankCol?.xEnd ?? 40;

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
    const rank = parseInt(rankText.replace(/[a-z]+$/i, ""), 10);
    if (isNaN(rank)) continue;

    // NAT from dedicated Nationality column
    const nat = colText(items, "nat", cols).trim();
    const nationality = /^[A-Z]{2,3}$/.test(nat) ? nat : undefined;

    // Sail number (plain integer) + NAT prefix
    const sailnoRaw = colText(items, "sailno", cols).trim();
    const sailno = sailnoRaw.replace(/\D/g, ""); // strip any non-digit noise
    const sailNumber = sailno
      ? nationality
        ? `${nationality} ${sailno}`
        : sailno
      : null;

    // Names
    const nameText = colText(items, "name", cols);
    const helm = parseSailingName(nameText);
    if (!helm.lastName && !helm.firstName) continue;

    const crewText = colText(items, "crewname", cols);
    const crew = parseSailingName(crewText);

    const club = colText(items, "club", cols) || null;

    // Points
    const totaleText = colText(items, "totale", cols);
    const nettoText = colText(items, "netto", cols);
    const totalPoints = totaleText ? parseDecimal(totaleText) : null;
    const netPoints = nettoText ? parseDecimal(nettoText) : null;

    // Race scores
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
  return parsePages(pages);
}
