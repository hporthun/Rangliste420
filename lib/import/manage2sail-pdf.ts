/**
 * Parses Manage2Sail "Overall Results" PDF.
 * Returns only helm entries (no crew — use paste parser when crew data is needed).
 * Uses X-position column detection since PDF text items lack logical structure.
 */
import type { ParsedRaceScore, ParsedEntry, ParsedRegatta } from "./manage2sail-paste";

const PENALTY_CODES = new Set(["DNC", "DNS", "DNF", "DSQ", "BFD", "OCS", "RET", "WFD"]);

// Column X boundaries (from empirical M2S PDF layout)
const X_NAME_MIN = 178;  // Name column start
const X_NAME_MAX = 248;  // Name column end (club starts at ~249)
const X_RANK_MAX = 100;  // Rank/Sail column (both rank num and sail number)
const X_SCORES_MIN = 388; // Race score columns start
const X_TOTAL = 488;     // Total column
// const X_NET = 505; // Net column — unused, kept for layout reference
// Scores that exceed this are likely totals merged into a score cell (for fleets ≤ ~48 boats)
const MAX_RACE_SCORE = 50;

type RawItem = { str: string; x: number; y: number };

const HEADER_RE = [
  /^Page \d+ of \d+$/,
  /^Report Created/,
  /^Powered by/,
  /^Overall Results$/,
  /^As of \d/,
  /^Wettfahrtleiter/,
  /^st\. Wettfahrtleiter/,
  /^(Obmann|Mitglied) /,
  /^Discard rule/,
  /^Points per Race$/,
  /^Rk\. Sail$|^Number$|^Boat Name$|^Name$|^Club$|^Total$|^Net$|^Pts\.$|^R\d+$/,
  /^Scoring system/,
  /^\d{3}$/, // class number (e.g. "420")
];

function isHeaderItem(str: string) {
  return HEADER_RE.some((re) => re.test(str));
}

/** Groups items by approximate Y position (within 6px = same row). Returns rows sorted descending Y. */
function groupByRow(items: RawItem[]): RawItem[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: RawItem[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const row = rows[rows.length - 1];
    if (Math.abs(sorted[i].y - row[0].y) <= 6) {
      row.push(sorted[i]);
    } else {
      rows.push([sorted[i]]);
    }
  }
  return rows;
}

/**
 * Parses a name string like "Nicolas TROEGER", "Paul FRANZ", or just "MÜLLER".
 * Returns null if no valid all-caps last-name token found.
 * Only accepts clean letter/hyphen tokens as last name (rejects "V.)", "(Club", etc.).
 */
function parseNameItem(str: string): { firstName: string; lastName: string } | null {
  const parts = str.trim().split(/\s+/).filter(Boolean);
  let lastNameStart = -1;
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (w === w.toUpperCase() && /[A-ZÄÖÜ]/.test(w) && /^[A-ZÄÖÜ-]+$/.test(w)) {
      lastNameStart = i;
      break;
    }
  }
  if (lastNameStart < 0) return null;
  const firstParts = parts.slice(0, lastNameStart);
  const lastParts: string[] = [];
  for (let i = lastNameStart; i < parts.length; i++) {
    if (parts[i].startsWith("(") || !/^[A-ZÄÖÜ-]+$/.test(parts[i])) break;
    lastParts.push(parts[i]);
  }
  if (!lastParts.length) return null;
  return { firstName: firstParts.join(" "), lastName: lastParts.join(" ") };
}

/** Parses a score string, returning one or more score tokens. */
function parseScoreTokens(str: string): Array<{ points: number; isDiscard: boolean }> {
  if (PENALTY_CODES.has(str.trim())) return [];
  const tokens: Array<{ points: number; isDiscard: boolean }> = [];
  const re = /\(?([\d.]+)\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const raw = m[0];
    const isDiscard = raw.startsWith("(");
    tokens.push({ points: parseFloat(m[1]), isDiscard });
  }
  return tokens;
}

type EntryBlock = {
  rank: number | null;
  sailNumber: string | null;
  nameItems: string[];
  scoreItems: RawItem[];
};

export async function parsePdfBuffer(buffer: ArrayBuffer | Uint8Array): Promise<ParsedRegatta> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;

  const entries: ParsedEntry[] = [];
  let currentBlock: EntryBlock | null = null;

  function commitBlock(block: EntryBlock) {
    if (!block.sailNumber || !block.rank) return;

    // Sort score items left-to-right
    const sortedScoreItems = block.scoreItems.sort((a, b) => a.x - b.x);

    const rawScoreItems = sortedScoreItems.filter((i) => i.x < X_TOTAL);
    const totalNetItems = sortedScoreItems.filter((i) => i.x >= X_TOTAL).sort((a, b) => a.x - b.x);

    let totalPts: number | null = null;
    let netPts: number | null = null;

    if (totalNetItems.length >= 2) {
      totalPts = parseFloat(totalNetItems[0].str);
      netPts = parseFloat(totalNetItems[1].str);
    } else if (totalNetItems.length === 1) {
      // Total is merged into a score cell; net appears alone
      netPts = parseFloat(totalNetItems[0].str);
    }

    const raceScores: ParsedRaceScore[] = [];
    for (const item of rawScoreItems) {
      const str = item.str.trim();
      if (PENALTY_CODES.has(str)) {
        if (raceScores.length > 0) {
          raceScores[raceScores.length - 1] = { ...raceScores[raceScores.length - 1], code: str };
        }
        continue;
      }
      for (const tok of parseScoreTokens(str)) {
        if (tok.points > MAX_RACE_SCORE) {
          // Likely Total merged into score cell
          if (totalPts == null) totalPts = tok.points;
          continue;
        }
        raceScores.push({ race: raceScores.length + 1, ...tok });
      }
    }

    // Parse helm name from collected name items
    let helmFirst = "";
    let helmLast = "";
    for (const ni of block.nameItems) {
      if (ni.startsWith("(")) continue;
      const parsed = parseNameItem(ni);
      if (parsed) {
        if (parsed.firstName) helmFirst = parsed.firstName;
        if (parsed.lastName) helmLast = parsed.lastName;
      } else if (helmLast === "" && /^[A-ZÄÖÜa-zäöü]/.test(ni) && !/^\d/.test(ni)) {
        // Plain first-name fragment (e.g. "Nicolas", "Bjarne")
        helmFirst = (helmFirst + " " + ni).trim();
      }
    }

    const inStartAreaSuggestion = raceScores.some((s) =>
      ["DNS", "BFD", "OCS"].includes(s.code ?? "")
    );

    entries.push({
      rank: block.rank,
      sailNumber: block.sailNumber,
      helmFirstName: helmFirst,
      helmLastName: helmLast,
      crewFirstName: null,
      crewLastName: null,
      club: null,
      totalPoints: totalPts,
      netPoints: netPts,
      raceScores,
      inStartAreaSuggestion,
    });
  }

  // Process each page separately (PDF pages reuse the same Y coordinate space)
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageItems: RawItem[] = [];
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      pageItems.push({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      });
    }

    for (const row of groupByRow(pageItems)) {
      const rankSailItems = row.filter((i) => i.x < X_RANK_MAX && !isHeaderItem(i.str));
      const nameItems = row.filter((i) => i.x >= X_NAME_MIN && i.x < X_NAME_MAX && !isHeaderItem(i.str));
      const scoreItems = row.filter((i) => i.x >= X_SCORES_MIN && !isHeaderItem(i.str) && i.str !== "Pts.");

      // Detect new entry start from rank/sail column items
      for (const item of rankSailItems) {
        const fullRankSail = /^(\d{1,3})\s+((?:[A-Z]{3}\s+)?\d{4,6})$/.exec(item.str);
        const onlyRank = /^(\d{1,3})$/.exec(item.str);
        const onlySail = /^((?:[A-Z]{3}\s+)?\d{4,6})$/.exec(item.str);

        if (fullRankSail) {
          if (currentBlock) commitBlock(currentBlock);
          currentBlock = {
            rank: parseInt(fullRankSail[1], 10),
            sailNumber: fullRankSail[2],
            nameItems: [],
            scoreItems: [],
          };
        } else if (onlyRank) {
          // Always start a new block for a rank number in the rank column
          if (currentBlock) commitBlock(currentBlock);
          currentBlock = { rank: parseInt(onlyRank[1], 10), sailNumber: null, nameItems: [], scoreItems: [] };
        } else if (onlySail && currentBlock && currentBlock.sailNumber == null) {
          currentBlock.sailNumber = onlySail[1];
        }
      }

      if (!currentBlock) continue;

      for (const item of nameItems) {
        currentBlock.nameItems.push(item.str);
      }
      for (const item of scoreItems) {
        currentBlock.scoreItems.push(item);
      }
    }
  }

  if (currentBlock) commitBlock(currentBlock);

  const numRaces = entries.length > 0
    ? Math.max(...entries.map((e) => e.raceScores.length))
    : 0;

  return { entries, numRaces, totalStarters: entries.length };
}
