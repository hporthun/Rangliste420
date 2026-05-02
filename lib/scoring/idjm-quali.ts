/**
 * IDJM-Quali filter (DSV-MO Anlage Jugend, MO 10).
 *
 * Altersregel: Das gesamte Saisonjahr gilt — der gewählte Altersfilter
 * (z. B. U19, U17, U16, U15) wird auf den Saisonstichtag (`referenceDate`)
 * angewandt. Issue #53: Auch OPEN und U22 sind als Filter zulässig — die
 * IDJM-Quali-Rangliste lässt damit alle Jahrgänge zu.
 *
 * R ≥ 25 threshold is applied to the result.
 *
 * **Wichtig** (User-Klarstellung 2026-04-29):
 * Die Gesamtteilnehmerzahl `s` einer Regatta wird IMMER ungefiltert
 * verwendet — auch wenn ausländische Boote dabei sind und auch wenn ein
 * Teil der Crews die IDJM-Altersgrenze nicht erfüllt. `s` gibt schlicht
 * die Anzahl der gestarteten Boote der Regatta wieder, das Filtern
 * passiert nur auf der Helm-Seite (welche Helm-Reihen tauchen in der
 * IDJM-Rangliste auf).
 */

import { calculateDsvRanking } from "./dsv";
import type { DsvRankingResult, RegattaData, DsvRankingInput } from "./dsv";
import type { AgeCategory, GenderCategory } from "./filters";

export type IdjmQualiInput = {
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
  regattas: RegattaData[];
  referenceDate: Date;
  scoringUnit?: "HELM" | "CREW";
};

export const IDJM_MIN_R = 25;

export function calculateIdjmQuali(input: IdjmQualiInput): DsvRankingResult {
  const dsvInput: DsvRankingInput = {
    seasonYear: input.referenceDate.getFullYear(),
    ageCategory: input.ageCategory,
    genderCategory: input.genderCategory,
    referenceDate: input.referenceDate,
    regattas: input.regattas,
    scoringUnit: input.scoringUnit,
  };

  const result = calculateDsvRanking(dsvInput);

  // Apply IDJM R ≥ 25 threshold.
  return {
    rankings: result.rankings.filter((r) => r.R >= IDJM_MIN_R),
  };
}
