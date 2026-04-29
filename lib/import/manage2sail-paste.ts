export type ParsedRaceScore = {
  race: number;
  points: number;
  code?: string;
  isDiscard: boolean;
};

export type ParsedEntry = {
  rank: number | null;
  sailNumber: string | null;
  helmFirstName: string;
  helmLastName: string;
  crewFirstName: string | null;
  crewLastName: string | null;
  club: string | null;
  totalPoints: number | null;
  netPoints: number | null;
  raceScores: ParsedRaceScore[];
  /** Suggested value based on DNS/BFD/OCS codes — admin reviews in wizard */
  inStartAreaSuggestion: boolean;
  /**
   * ISO-3166-1 alpha-3 nationality, derived from the sail-number country
   * prefix (e.g. "GER 12345" → "GER") or from the M2S API's
   * SailNumberCountry/Country fields. When unknown, falls back to the
   * Sailor schema's default "GER" at import time.
   */
  nationality?: string;
};

export type ParsedRegatta = {
  entries: ParsedEntry[];
  numRaces: number;
  /**
   * Anzahl der gestarteten Boote insgesamt — inkl. ausländischer Crews,
   * die durch einen Country-Filter ggf. nicht in `entries` landen.
   *
   * Hintergrund: Die DSV-Formel R_A = f × 100 × ((s+1−x)/s) braucht für
   * `s` die echte Gesamtteilnehmerzahl. Wenn der Import nur deutsche Crews
   * herausschneidet, würde s zu klein, und R_A wäre falsch.
   *
   * Parser, die ohnehin alle Einträge liefern (Paste, PDF), setzen den
   * Wert auf `entries.length`. Der M2S-API-Parser zählt zusätzlich die
   * vor dem germanOnly-Filter gesehenen Einträge.
   */
  totalStarters?: number;
};

const PENALTY_CODES = new Set(["DNC", "DNS", "DNF", "DSQ", "BFD", "OCS", "RET", "WFD"]);
const SCORE_RE = /^\(?([\d.]+)\)?$/;
const RANK_RE = /^(\d+)\t?$/;
const SAIL_RE = /^\s*((?:[A-Z]{3}\s+)?\d{4,6})\s*$/;
const CLUB_TOTALS_RE = /^(.+?)\t([\d.]+)\t([\d.]+)\t?$/;

/** Splits "Firstname(s) LASTNAME" → { firstName, lastName }. LASTNAME is all-uppercase. */
function parseName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/);
  let lastNameStart = parts.length - 1;
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (w === w.toUpperCase() && /[A-ZÄÖÜ]/.test(w)) {
      lastNameStart = i;
      break;
    }
  }
  const firstName = parts.slice(0, lastNameStart).join(" ");
  const lastName = parts.slice(lastNameStart).join(" ");
  // Edge: if nothing before last-name start, treat whole string as last name
  return {
    firstName: firstName || lastName,
    lastName: firstName ? lastName : "",
  };
}

/** Returns true if line is a penalty code (e.g. "DNC", "DNS"). */
function isPenaltyCode(line: string): boolean {
  return PENALTY_CODES.has(line.trim());
}

/** Returns parsed score or null if line is not a score. */
function parseScoreLine(line: string): { points: number; isDiscard: boolean } | null {
  const m = line.trim().match(SCORE_RE);
  if (!m) return null;
  return {
    points: parseFloat(m[1]),
    isDiscard: line.trim().startsWith("("),
  };
}

type ParserState = "SEEKING_RANK" | "SAIL" | "HELM" | "CREW" | "CLUB" | "RACES";

export function parsePaste(text: string): ParsedRegatta {
  const lines = text.split("\n").map((l) => l.trimEnd());

  const entries: ParsedEntry[] = [];
  let state: ParserState = "SEEKING_RANK";

  let rank: number | null = null;
  let sailNumber: string | null = null;
  let helmFirstName = "";
  let helmLastName = "";
  let crewFirstName: string | null = null;
  let crewLastName: string | null = null;
  let club: string | null = null;
  let totalPoints: number | null = null;
  let netPoints: number | null = null;
  let raceScores: ParsedRaceScore[] = [];

  function commitEntry() {
    if (helmLastName) {
      const inStartAreaSuggestion = raceScores.some((s) =>
        ["DNS", "BFD", "OCS"].includes(s.code ?? "")
      );
      entries.push({
        rank,
        sailNumber,
        helmFirstName,
        helmLastName,
        crewFirstName,
        crewLastName,
        club,
        totalPoints,
        netPoints,
        raceScores,
        inStartAreaSuggestion,
      });
    }
  }

  function resetEntry(newRank: number) {
    commitEntry();
    rank = newRank;
    sailNumber = null;
    helmFirstName = "";
    helmLastName = "";
    crewFirstName = null;
    crewLastName = null;
    club = null;
    totalPoints = null;
    netPoints = null;
    raceScores = [];
    state = "SAIL";
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (state === "SEEKING_RANK") {
      const rm = trimmed.match(RANK_RE);
      if (rm) resetEntry(parseInt(rm[1], 10));
      continue;
    }

    // In any non-seeking state, a rank line starts a new entry
    const rm = trimmed.match(RANK_RE);
    if (rm && state === "RACES") {
      resetEntry(parseInt(rm[1], 10));
      continue;
    }

    switch (state as ParserState) {
      case "SAIL": {
        if (!trimmed) break;
        const sm = trimmed.match(SAIL_RE);
        if (sm) {
          sailNumber = sm[1].trim();
          state = "HELM";
        }
        break;
      }
      case "HELM": {
        if (!trimmed) break;
        const n = parseName(trimmed);
        helmFirstName = n.firstName;
        helmLastName = n.lastName;
        state = "CREW";
        break;
      }
      case "CREW": {
        if (!trimmed) break;
        const n = parseName(trimmed);
        crewFirstName = n.firstName;
        crewLastName = n.lastName;
        state = "CLUB";
        break;
      }
      case "CLUB": {
        if (!trimmed) break;
        const cm = trimmed.match(CLUB_TOTALS_RE);
        if (cm) {
          club = cm[1] || null;
          totalPoints = parseFloat(cm[2]);
          netPoints = parseFloat(cm[3]);
          state = "RACES";
        }
        break;
      }
      case "RACES": {
        if (!trimmed) break;
        if (isPenaltyCode(trimmed)) {
          // Attach code to the most recent score (if any)
          if (raceScores.length > 0) {
            raceScores[raceScores.length - 1] = {
              ...raceScores[raceScores.length - 1],
              code: trimmed,
            };
          }
        } else {
          const parsed = parseScoreLine(trimmed);
          if (parsed) {
            raceScores.push({
              race: raceScores.length + 1,
              ...parsed,
            });
          }
        }
        break;
      }
    }
  }

  commitEntry();

  const numRaces = Math.max(0, ...entries.map((e) => e.raceScores.length));
  // Paste-Quelle enthält ohnehin alle Einträge (kein Country-Filter), also
  // ist die Gesamtteilnehmerzahl identisch mit `entries.length`.
  return { entries, numRaces, totalStarters: entries.length };
}
