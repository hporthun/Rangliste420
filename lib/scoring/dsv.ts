/**
 * DSV-Ranglistenordnung (RO) Anlage 1, §1–4 — Scoring engine
 * Gültig ab 01.01.2026
 *
 * Formel: R_A = f × 100 × ((s + 1 − x) / s)
 * R = arithmetisches Mittel der 9 besten R_A-Werte
 */

import { calculateMultiplier } from "./multiplier";
import { matchesAgeCategory, matchesGenderCategory } from "./filters";
import type { AgeCategory, GenderCategory } from "./filters";

export type { AgeCategory, GenderCategory };

// ── Input types ───────────────────────────────────────────────────────────────

export type SailorData = {
  id: string;
  birthYear: number | null;
  gender: string | null;
};

export type TeamEntryData = {
  helmId: string;
  crewId: string | null;
  helm: SailorData;
  crew: SailorData | null;
};

export type ResultData = {
  id: string;
  teamEntry: TeamEntryData;
  finalRank: number | null;
  inStartArea: boolean;
};

export type RegattaData = {
  id: string;
  name: string;
  ranglistenFaktor: number;
  completedRaces: number;
  multiDayAnnouncement: boolean;
  startDate: Date;
  results: ResultData[];
};

export type DsvRankingInput = {
  seasonYear: number;
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
  /**
   * Age check reference date.
   * Jahresrangliste: new Date(seasonYear, 11, 31)
   * IDJM / per-regatta check: regatta.startDate (handled by caller per regatta)
   */
  referenceDate: Date;
  regattas: RegattaData[];
};

// ── Output types ──────────────────────────────────────────────────────────────

export type RankingValue = {
  value: number;
  regattaId: string;
  f: number;
  s: number;
  x: number | null;
  m: number;
  multiplierIndex: number;
  inStartArea: boolean;
};

export type HelmRanking = {
  helmId: string;
  rank: number;
  R: number;
  top9: RankingValue[];
  /** All values for this helm, sorted desc by value — includes non-contributing entries */
  allValues: RankingValue[];
};

export type DsvRankingResult = {
  rankings: HelmRanking[];
};

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Calculates R_A for a single result.
 * Caller is responsible for passing the correct x (finalRank).
 */
export function calculateRA({ f, s, x }: { f: number; s: number; x: number }): number {
  return f * 100 * ((s + 1 - x) / s);
}

/**
 * Pure scoring function — no DB calls.
 * Pass pre-fetched regattas with their results.
 */
export function calculateDsvRanking(input: DsvRankingInput): DsvRankingResult {
  const { ageCategory, genderCategory, referenceDate, regattas } = input;

  const sailorValues = new Map<string, RankingValue[]>();

  for (const regatta of regattas) {
    const m = calculateMultiplier(regatta.completedRaces, regatta.multiDayAnnouncement);
    const f = regatta.ranglistenFaktor;
    const s = regatta.results.length;

    if (s === 0 || m === 0) continue;

    for (const result of regatta.results) {
      const { teamEntry } = result;

      if (!matchesAgeCategory(teamEntry, ageCategory, referenceDate)) continue;
      if (!matchesGenderCategory(teamEntry, genderCategory)) continue;

      // Boats in start area without a finish rank get R_A = 0
      const rA =
        result.inStartArea && result.finalRank == null
          ? 0
          : calculateRA({ f, s, x: result.finalRank! });

      const helmId = teamEntry.helmId;
      if (!sailorValues.has(helmId)) sailorValues.set(helmId, []);
      const values = sailorValues.get(helmId)!;

      for (let i = 0; i < m; i++) {
        values.push({
          value: rA,
          regattaId: regatta.id,
          f,
          s,
          x: result.finalRank,
          m,
          multiplierIndex: i,
          inStartArea: result.inStartArea,
        });
      }
    }
  }

  const rankings: HelmRanking[] = [];

  for (const [helmId, values] of sailorValues) {
    if (values.length < 9) continue;

    const sorted = [...values].sort((a, b) => b.value - a.value);
    const top9 = sorted.slice(0, 9);
    const R = top9.reduce((sum, v) => sum + v.value, 0) / 9;

    rankings.push({ helmId, rank: 0, R, top9, allValues: sorted });
  }

  // Tiebreak: 1) R desc, 2) best single R_A in top9 desc, 3) total values count desc
  rankings.sort((a, b) => {
    const rDiff = b.R - a.R;
    if (Math.abs(rDiff) > 1e-10) return rDiff;
    const aBest = a.top9[0]?.value ?? 0;
    const bBest = b.top9[0]?.value ?? 0;
    const bestDiff = bBest - aBest;
    if (Math.abs(bestDiff) > 1e-10) return bestDiff;
    return b.allValues.length - a.allValues.length;
  });

  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return { rankings };
}
