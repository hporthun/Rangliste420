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
  /**
   * Whether this entry's crew change has been formally approved.
   * Only consumed by the JWM/JEM-Quali scoring (see `jwm-jem-quali.ts`);
   * DSV/IDJM rankings ignore this flag.
   */
  crewSwapApproved?: boolean;
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
  /**
   * Anzahl gestarteter Boote insgesamt — inkl. ausländischer Crews, die
   * ggf. nicht importiert wurden. Wenn null/undefined, fällt `s` auf
   * `results.length` zurück (Legacy-Datensätze ohne diesen Wert).
   */
  totalStarters?: number | null;
  results: ResultData[];
};

export type DsvRankingInput = {
  seasonYear: number;
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
  /**
   * Age check reference date. Das gesamte Saisonjahr gilt — ausgewertet
   * wird nur der Jahr-Teil (`getFullYear()`). Beispiele:
   *   Jahresrangliste:    new Date(seasonYear, 11, 31)
   *   Aktuelle Rangliste: new Date()
   *   IDJM-Quali:         Saisonstichtag (siehe docs/business-rules.md §2.3)
   */
  referenceDate: Date;
  regattas: RegattaData[];
  /**
   * Gruppiert die Rangliste nach Steuermann (HELM, Standard) oder
   * nach Vorschoter (CREW). Einträge ohne bekannte crewId werden in
   * CREW-Modus übersprungen.
   */
  scoringUnit?: "HELM" | "CREW";
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
  /** helmId (HELM-Modus) oder crewId (CREW-Modus) */
  sailorId: string;
  rank: number;
  R: number;
  top9: RankingValue[];
  /** All values for this sailor, sorted desc by value — includes non-contributing entries */
  allValues: RankingValue[];
};

/**
 * Sailor mit Wertungen, aber unterhalb der 9-Wertungs-Schwelle der DSV-Rangliste.
 * Wird auf den Ranglisten-Detailseiten als "Noch nicht in der Wertung" angezeigt,
 * damit Trainer/Segler sehen, wie weit sie noch sind.
 */
export type BelowCutoffEntry = {
  /** helmId (HELM-Modus) oder crewId (CREW-Modus) */
  sailorId: string;
  /** Anzahl bisher gesammelter Wertungen (nach m-Multiplikation) */
  valuesCount: number;
  /** Alle Werte sortiert desc — analog zu HelmRanking.allValues */
  allValues: RankingValue[];
};

export type DsvRankingResult = {
  rankings: HelmRanking[];
  belowCutoff: BelowCutoffEntry[];
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
 * Computes R_A for an imported result, honouring the "in start area" rule.
 *
 * - `inStartArea && finalRank == null` (Boot kam ins Startgebiet, hat aber
 *   nicht beendet — DNS/BFD/OCS) → R_A = 0 (zählt aber m-fach in s).
 * - `finalRank != null` → R_A nach DSV-Formel.
 * - `finalRank == null && !inStartArea` (Boot ist nicht gestartet, DNC) →
 *   `null` zurückgeben; der Caller filtert dieses Ergebnis aus seiner
 *   Werteliste raus.
 *
 * Single source of truth für diese Logik — wird sowohl von der
 * Scoring-Engine (calculateDsvRanking) als auch von der öffentlichen
 * Regatta-Detail-Anzeige genutzt, damit beide Pfade nicht auseinanderdriften.
 */
export function calculateRAForResult(
  f: number,
  s: number,
  result: { finalRank: number | null; inStartArea: boolean }
): number | null {
  if (result.inStartArea && result.finalRank == null) return 0;
  if (result.finalRank == null) return null;
  return calculateRA({ f, s, x: result.finalRank });
}

/**
 * Pure scoring function — no DB calls.
 * Pass pre-fetched regattas with their results.
 */
export function calculateDsvRanking(input: DsvRankingInput): DsvRankingResult {
  const { ageCategory, genderCategory, referenceDate, regattas, scoringUnit = "HELM" } = input;

  const sailorValues = new Map<string, RankingValue[]>();

  for (const regatta of regattas) {
    const m = calculateMultiplier(regatta.completedRaces, regatta.multiDayAnnouncement);
    const f = regatta.ranglistenFaktor;
    // s = Gesamtteilnehmerzahl der Regatta (inkl. ausländischer Boote).
    // Bevorzugt aus dem persistierten `totalStarters`-Feld (vom Import oder
    // manuell auf der Regatta gepflegt). Fallback auf `results.length`,
    // wenn kein expliziter Wert vorliegt — das ist die Anzahl tatsächlich
    // importierter Crews, was bei reinen Inlandsregatten ebenfalls korrekt
    // ist. Alters-/Gender-Filter wirken nur auf die Helm-Reihen, nicht auf s.
    const s = regatta.totalStarters ?? regatta.results.length;

    if (s === 0 || m === 0) continue;

    for (const result of regatta.results) {
      const { teamEntry } = result;

      if (!matchesAgeCategory(teamEntry, ageCategory, referenceDate)) continue;
      if (!matchesGenderCategory(teamEntry, genderCategory)) continue;

      // Single source of truth für die "inStartArea = R_A 0"-Logik.
      // Boote ohne finalRank UND ohne inStartArea (= DNC) liefern null
      // zurück → werden hier mit `continue` übersprungen, damit sie
      // weder in der Werteliste auftauchen noch s verfälschen.
      const rA = calculateRAForResult(f, s, result);
      if (rA == null) continue;

      const sailorId = scoringUnit === "CREW" ? teamEntry.crewId : teamEntry.helmId;
      if (!sailorId) continue;
      if (!sailorValues.has(sailorId)) sailorValues.set(sailorId, []);
      const values = sailorValues.get(sailorId)!;

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
  const belowCutoff: BelowCutoffEntry[] = [];

  for (const [sailorId, values] of sailorValues) {
    const sorted = [...values].sort((a, b) => b.value - a.value);

    if (values.length < 9) {
      belowCutoff.push({ sailorId, valuesCount: values.length, allValues: sorted });
      continue;
    }

    const top9 = sorted.slice(0, 9);
    const R = top9.reduce((sum, v) => sum + v.value, 0) / 9;

    rankings.push({ sailorId, rank: 0, R, top9, allValues: sorted });
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

  // Below-Cutoff: meiste Wertungen zuerst, dann sailorId für deterministische Reihenfolge.
  belowCutoff.sort((a, b) => b.valuesCount - a.valuesCount || a.sailorId.localeCompare(b.sailorId));

  return { rankings, belowCutoff };
}
