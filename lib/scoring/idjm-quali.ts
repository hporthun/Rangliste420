/**
 * IDJM-Quali filter (DSV-MO Anlage Jugend, MO 10).
 *
 * Key difference from calculateDsvRanking:
 * - Age check is per-regatta using regatta.startDate (not a global referenceDate).
 *   A result is excluded if helm or crew was too old AT THAT REGATTA's start.
 * - R ≥ 25 threshold is applied to the result.
 *
 * This means a sailor who qualifies by age at Dec 31 (Jahresrangliste) may
 * lose individual regatta results in IDJM if their crew turned too old
 * before a specific regatta's startDate.
 */

import { calculateDsvRanking } from "./dsv";
import { matchesAgeCategory, matchesGenderCategory } from "./filters";
import type { DsvRankingResult, RegattaData, DsvRankingInput } from "./dsv";
import type { AgeCategory, GenderCategory } from "./filters";

export type IdjmQualiInput = {
  ageCategory: Extract<AgeCategory, "U19" | "U16">;
  genderCategory: GenderCategory;
  regattas: RegattaData[];
};

export const IDJM_MIN_R = 25;

export function calculateIdjmQuali(input: IdjmQualiInput): DsvRankingResult {
  // Pre-filter each regatta's results using that regatta's startDate as the age reference.
  const filteredRegattas: RegattaData[] = input.regattas.map((regatta) => ({
    ...regatta,
    results: regatta.results.filter(
      (result) =>
        matchesAgeCategory(result.teamEntry, input.ageCategory, regatta.startDate) &&
        matchesGenderCategory(result.teamEntry, input.genderCategory)
    ),
  }));

  // Run standard DSV ranking with OPEN categories (filtering already done above).
  const dsvInput: DsvRankingInput = {
    seasonYear: 0,  // unused — age/gender already filtered
    ageCategory: "OPEN",
    genderCategory: "OPEN",
    referenceDate: new Date(0),  // unused
    regattas: filteredRegattas,
  };

  const result = calculateDsvRanking(dsvInput);

  // Apply IDJM R ≥ 25 threshold.
  return {
    rankings: result.rankings.filter((r) => r.R >= IDJM_MIN_R),
  };
}
