/**
 * JWM/JEM-Qualifikationsrangliste — klassenspezifische Sonderregel.
 * Quelle: 420er-Klassenvereinigung (https://420class.de/index.php/sport/quali)
 * Gültig für Saison 2026.
 *
 * Regel:
 * - Bis zu 3 Regatten werden ausgewählt.
 * - Gewichteter Platz: weightedScore = finalRank × (maxStarters / thisRegattaStarters)
 * - qualiScore = Summe der 2 besten (niedrigsten) weightedScores
 * - ≥ 2 Ergebnisse → Hauptrangliste (qualiScore aufsteigend)
 * - genau 1 Ergebnis → "Vorläufig / Zwischenergebnis"
 * - 0 Ergebnisse → nicht angezeigt
 * - Tiebreak: 1) niedrigster bester einzelner weightedScore, 2) mehr Regatten teilgenommen
 *
 * Wichtig: DSV-Formel wird NICHT verwendet (anderes Modul).
 */

import { matchesAgeCategory, matchesGenderCategory } from "./filters";
import type { AgeCategory, GenderCategory } from "./filters";
import type { RegattaData } from "./dsv";

// ── Output types ───────────────────────────────────────────────────────────────

export type JwmJemRegattaSlot = {
  regattaId: string;
  regattaName: string;
  regattaDate: string;
  starters: number;
  finalRank: number | null;
  weightedScore: number | null;
  /** true if this slot is one of the 2 best counted scores */
  counted: boolean;
};

export type JwmJemRow = {
  helmId: string;
  rank: number | null;
  qualiScore: number;
  regattaSlots: JwmJemRegattaSlot[];
  validCount: number;
};

export type JwmJemInput = {
  regattas: RegattaData[];
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
  referenceDate: Date;
  germanOnly: boolean;
  helmNationalities: Record<string, string>;
};

export type JwmJemOutput = {
  ranked: JwmJemRow[];
  preliminary: JwmJemRow[];
  maxStarters: number;
  startersByRegatta: Record<string, number>;
};

// ── Pure scoring function ──────────────────────────────────────────────────────

export function calculateJwmJemQuali(input: JwmJemInput): JwmJemOutput {
  const { regattas, ageCategory, genderCategory, referenceDate, germanOnly, helmNationalities } =
    input;

  // starters per regatta = results with finalRank !== null
  const startersByRegatta: Record<string, number> = {};
  for (const regatta of regattas) {
    startersByRegatta[regatta.id] = regatta.results.filter(
      (r) => r.finalRank !== null
    ).length;
  }

  const maxStarters = Math.max(0, ...Object.values(startersByRegatta));

  // Collect all helm IDs that appear across the selected regattas
  const allHelmIds = new Set<string>();
  for (const regatta of regattas) {
    for (const result of regatta.results) {
      allHelmIds.add(result.teamEntry.helmId);
    }
  }

  // Build per-helm rows
  const rows: JwmJemRow[] = [];

  for (const helmId of allHelmIds) {
    // Nationality filter (applied before any score computation)
    if (germanOnly) {
      const nat = helmNationalities[helmId];
      if (nat !== "GER") continue;
    }

    const slots: JwmJemRegattaSlot[] = [];

    for (const regatta of regattas) {
      // Find this helm's result in this regatta
      const result = regatta.results.find((r) => r.teamEntry.helmId === helmId);

      if (!result) {
        // Helm did not participate in this regatta → slot with null rank
        slots.push({
          regattaId: regatta.id,
          regattaName: regatta.name,
          regattaDate: regatta.startDate.toISOString(),
          starters: startersByRegatta[regatta.id],
          finalRank: null,
          weightedScore: null,
          counted: false,
        });
        continue;
      }

      // Age and gender check uses per-regatta startDate as reference
      const ageRef =
        ageCategory === "OPEN" ? referenceDate : regatta.startDate;
      const passesAge = matchesAgeCategory(result.teamEntry, ageCategory, ageRef);
      const passesGender = matchesGenderCategory(result.teamEntry, genderCategory);

      if (!passesAge || !passesGender) {
        // Fails filter for this regatta → treat as not participated
        slots.push({
          regattaId: regatta.id,
          regattaName: regatta.name,
          regattaDate: regatta.startDate.toISOString(),
          starters: startersByRegatta[regatta.id],
          finalRank: null,
          weightedScore: null,
          counted: false,
        });
        continue;
      }

      const starters = startersByRegatta[regatta.id];
      const finalRank = result.finalRank;

      // Only entries with a finalRank get a weightedScore
      const weightedScore =
        finalRank !== null && starters > 0
          ? finalRank * (maxStarters / starters)
          : null;

      slots.push({
        regattaId: regatta.id,
        regattaName: regatta.name,
        regattaDate: regatta.startDate.toISOString(),
        starters,
        finalRank,
        weightedScore,
        counted: false, // filled in below
      });
    }

    // Slots with actual weighted scores
    const validSlots = slots.filter((s) => s.weightedScore !== null);
    const validCount = validSlots.length;

    // Pick 2 best (lowest weightedScore) for qualiScore
    const sortedByScore = [...validSlots].sort(
      (a, b) => (a.weightedScore ?? Infinity) - (b.weightedScore ?? Infinity)
    );
    const best2 = sortedByScore.slice(0, 2);

    // Mark counted slots
    const countedIds = new Set(best2.map((s) => s.regattaId));
    for (const slot of slots) {
      slot.counted = countedIds.has(slot.regattaId) && slot.weightedScore !== null;
    }

    const qualiScore = best2.reduce((sum, s) => sum + (s.weightedScore ?? 0), 0);

    rows.push({
      helmId,
      rank: null,
      qualiScore,
      regattaSlots: slots,
      validCount,
    });
  }

  // Split into ranked (≥2 results) and preliminary (exactly 1 result)
  // 0 results → excluded entirely
  const ranked = rows.filter((r) => r.validCount >= 2);
  const preliminary = rows.filter((r) => r.validCount === 1);

  // Sort ranked: qualiScore asc, then tiebreaks
  function tiebreakSort(a: JwmJemRow, b: JwmJemRow): number {
    const scoreDiff = a.qualiScore - b.qualiScore;
    if (Math.abs(scoreDiff) > 1e-10) return scoreDiff;

    // Tiebreak 1: lower best single weightedScore
    const aBestSlot = a.regattaSlots
      .filter((s) => s.weightedScore !== null)
      .sort((x, y) => (x.weightedScore ?? Infinity) - (y.weightedScore ?? Infinity))[0];
    const bBestSlot = b.regattaSlots
      .filter((s) => s.weightedScore !== null)
      .sort((x, y) => (x.weightedScore ?? Infinity) - (y.weightedScore ?? Infinity))[0];
    const aBest = aBestSlot?.weightedScore ?? Infinity;
    const bBest = bBestSlot?.weightedScore ?? Infinity;
    const bestDiff = aBest - bBest;
    if (Math.abs(bestDiff) > 1e-10) return bestDiff;

    // Tiebreak 2: more regattas participated (higher validCount wins = lower index)
    return b.validCount - a.validCount;
  }

  ranked.sort(tiebreakSort);
  preliminary.sort(tiebreakSort);

  // Assign ranks for main ranking
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  return { ranked, preliminary, maxStarters, startersByRegatta };
}
