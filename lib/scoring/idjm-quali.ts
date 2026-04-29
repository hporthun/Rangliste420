/**
 * IDJM-Quali filter (DSV-MO Anlage Jugend, MO 10).
 *
 * Key difference from calculateDsvRanking (Jahresrangliste):
 * - Age check is per-regatta using regatta.startDate (not a global referenceDate).
 *   A result is excluded if helm or crew was too old AT THAT REGATTA's start.
 * - R ≥ 25 threshold is applied to the result.
 *
 * This means a sailor who qualifies by age at Dec 31 (Jahresrangliste) may
 * lose individual regatta results in IDJM if their crew turned too old
 * before a specific regatta's startDate.
 *
 * **Wichtig** (User-Klarstellung 2026-04-29):
 * Die Gesamtteilnehmerzahl `s` einer Regatta wird IMMER ungefiltert
 * verwendet — auch wenn ausländische Boote dabei sind und auch wenn ein
 * Teil der Crews die IDJM-Altersgrenze nicht erfüllt. `s` gibt schlicht
 * die Anzahl der gestarteten Boote der Regatta wieder, das Filtern
 * passiert nur auf der Helm-Seite (welche Helm-Reihen tauchen in der
 * IDJM-Rangliste auf).
 *
 * Vorher hat dieses Modul die Regatta-Ergebnisse pre-gefiltert und damit
 * `s` reduziert — das hat die R_A-Werte für IDJM verzerrt. Jetzt
 * delegieren wir die per-Regatta Altersprüfung über das
 * `useRegattaDateForAge`-Flag direkt an `calculateDsvRanking`, sodass `s`
 * unverändert die Gesamtanzahl bleibt.
 */

import { calculateDsvRanking } from "./dsv";
import type { DsvRankingResult, RegattaData, DsvRankingInput } from "./dsv";
import type { AgeCategory, GenderCategory } from "./filters";

export type IdjmQualiInput = {
  ageCategory: Extract<AgeCategory, "U19" | "U16">;
  genderCategory: GenderCategory;
  regattas: RegattaData[];
};

export const IDJM_MIN_R = 25;

export function calculateIdjmQuali(input: IdjmQualiInput): DsvRankingResult {
  const dsvInput: DsvRankingInput = {
    seasonYear: 0,             // unused — wir nutzen useRegattaDateForAge
    ageCategory: input.ageCategory,
    genderCategory: input.genderCategory,
    referenceDate: new Date(0), // unused
    regattas: input.regattas,
    // IDJM-Modus: pro Regatta startDate als Alters-Referenz; Filter wirkt
    // nur auf die Reihen, nicht auf s/x.
    useRegattaDateForAge: true,
  };

  const result = calculateDsvRanking(dsvInput);

  // Apply IDJM R ≥ 25 threshold.
  return {
    rankings: result.rankings.filter((r) => r.R >= IDJM_MIN_R),
  };
}
