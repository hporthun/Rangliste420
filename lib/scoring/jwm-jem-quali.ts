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
 * Schottenwechsel-Regel (Issue: User-Klarstellung 2026-04-29):
 *   "Pro Helm ist nur ein einziger Schottenwechsel zulässig, dieser muss
 *   genehmigt sein. In ungenehmigten Fällen wird es wie ein neues Team
 *   gewertet."
 *
 * Konkret: Ein "Team" ist die Kombination Helm + Crew. Wenn ein Helm in
 * verschiedenen Regatten unterschiedliche Crews segelt:
 *   - Sind alle Wechsel ungenehmigt → jede Helm/Crew-Kombi zählt als
 *     eigenständiges Team (eigene Zeile in der Quali-Rangliste).
 *   - Ein einziger genehmigter Wechsel hält das Team zusammen — das
 *     Team enthält dann beide Crews. Spätere weitere Wechsel (genehmigt
 *     oder nicht) starten jeweils ein neues Team.
 *
 * Algorithmus: Für jeden Helm sortieren wir seine Einträge chronologisch
 * und walken sie durch. Aktuell offenes Team trackt die akzeptierten
 * Crew-IDs und ob die Swap-Erlaubnis (1×) verbraucht ist.
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
  /**
   * Eindeutiger Team-Schlüssel innerhalb der Rangliste — `${helmId}::${primaryCrewId}`
   * oder `${helmId}::-` wenn keine Crew bekannt war beim ersten Eintrag.
   * Mehrere Zeilen für denselben Helm mit verschiedenen Crews sind möglich
   * (siehe Schottenwechsel-Regel im Header).
   */
  teamKey: string;
  /** Crew-IDs, die zu diesem Team gehören (1 oder 2 — letzteres bei genehmigtem Swap). */
  crewIds: (string | null)[];
  rank: number | null;
  qualiScore: number;
  regattaSlots: JwmJemRegattaSlot[];
  validCount: number;
  /** Ob dieses Team aus einem bereits gebrauchten Schottenwechsel resultiert
   *  (also nicht das "originale" Team des Helms ist). Nur informativ für die UI. */
  splitFromSwap: boolean;
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

type HelmEntry = {
  regatta: RegattaData;
  result: RegattaData["results"][number];
  crewId: string | null;
  crewSwapApproved: boolean;
};

type Team = {
  helmId: string;
  /** First crew of the team, used to derive teamKey. May be null for PDF-imports w/o crew. */
  primaryCrewId: string | null;
  /** Crew-IDs that "count" as this team (1 if no swap, 2 after one approved swap). */
  crewIds: Set<string | null>;
  /** Whether the (single) approved-swap allowance has already been consumed. */
  swapUsed: boolean;
  /** Entries that belong to this team, in chronological order. */
  entries: HelmEntry[];
  /** Ob dieses Team durch einen Split (ungenehmigter Wechsel oder zweiter Wechsel)
   *  entstanden ist und nicht das Anfangs-Team des Helms ist. */
  splitFromSwap: boolean;
};

/**
 * Partitioniert die chronologisch sortierten Einträge eines Helms in Teams.
 * Siehe Header-Doku für die Regel.
 */
function partitionTeams(entries: HelmEntry[]): Team[] {
  const sorted = [...entries].sort(
    (a, b) => a.regatta.startDate.getTime() - b.regatta.startDate.getTime()
  );
  if (sorted.length === 0) return [];

  const teams: Team[] = [];
  const helmId = sorted[0].result.teamEntry.helmId;

  function startNewTeam(e: HelmEntry, splitFromSwap: boolean): Team {
    return {
      helmId,
      primaryCrewId: e.crewId,
      crewIds: new Set([e.crewId]),
      swapUsed: false,
      entries: [e],
      splitFromSwap,
    };
  }

  let current: Team = startNewTeam(sorted[0], false);

  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];

    // Same crew as one of the team's accepted crews? → continue the team.
    if (current.crewIds.has(e.crewId)) {
      current.entries.push(e);
      continue;
    }

    // Different crew, swap allowance still available, AND swap is approved
    // for THIS entry → extend the team to also include this crew.
    if (!current.swapUsed && e.crewSwapApproved && e.crewId !== null) {
      current.crewIds.add(e.crewId);
      current.swapUsed = true;
      current.entries.push(e);
      continue;
    }

    // Otherwise: close the current team and start a new one. The new team
    // gets its own fresh swap allowance.
    teams.push(current);
    current = startNewTeam(e, true);
  }
  teams.push(current);
  return teams;
}

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

  // German-only re-ranking: when germanOnly=true, re-number ranks and count
  // starters among German sailors only per regatta.
  const germanStartersByRegatta: Record<string, number> = {};
  const germanRankMap: Record<string, Record<string, number>> = {};

  if (germanOnly) {
    for (const regatta of regattas) {
      const germanResults = regatta.results
        .filter(
          (r) =>
            r.finalRank !== null &&
            helmNationalities[r.teamEntry.helmId] === "GER"
        )
        .sort((a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity));

      germanStartersByRegatta[regatta.id] = germanResults.length;
      const rankMap: Record<string, number> = {};
      let currentRank = 1;
      for (let i = 0; i < germanResults.length; i++) {
        if (i > 0 && germanResults[i].finalRank !== germanResults[i - 1].finalRank) {
          currentRank = i + 1;
        }
        rankMap[germanResults[i].teamEntry.helmId] = currentRank;
      }
      germanRankMap[regatta.id] = rankMap;
    }
  }

  const effectiveStartersByRegatta = germanOnly
    ? germanStartersByRegatta
    : startersByRegatta;

  const maxStarters = Math.max(0, ...Object.values(effectiveStartersByRegatta));

  // Build per-helm entry list (one entry per regatta the helm sailed in,
  // carrying the crewId + approval flag).
  const helmEntries = new Map<string, HelmEntry[]>();
  for (const regatta of regattas) {
    for (const result of regatta.results) {
      const helmId = result.teamEntry.helmId;
      const list = helmEntries.get(helmId) ?? [];
      list.push({
        regatta,
        result,
        crewId: result.teamEntry.crewId,
        crewSwapApproved: result.teamEntry.crewSwapApproved ?? false,
      });
      helmEntries.set(helmId, list);
    }
  }

  // Build per-team rows.
  const rows: JwmJemRow[] = [];

  for (const [helmId, entries] of helmEntries) {
    // Nationality filter (applied before any score computation)
    if (germanOnly) {
      const nat = helmNationalities[helmId];
      if (nat !== "GER") continue;
    }

    const teams = partitionTeams(entries);

    for (const team of teams) {
      // Build slots for ALL selected regattas — even those this team did
      // NOT sail in (for visual consistency with the existing UI which
      // shows a row per regatta with "—" for non-participation).
      const slots: JwmJemRegattaSlot[] = [];

      for (const regatta of regattas) {
        const teamEntry = team.entries.find((e) => e.regatta.id === regatta.id);
        if (!teamEntry) {
          slots.push({
            regattaId: regatta.id,
            regattaName: regatta.name,
            regattaDate: regatta.startDate.toISOString(),
            starters: effectiveStartersByRegatta[regatta.id] ?? 0,
            finalRank: null,
            weightedScore: null,
            counted: false,
          });
          continue;
        }

        // Age and gender check uses per-regatta startDate as reference
        const ageRef =
          ageCategory === "OPEN" ? referenceDate : regatta.startDate;
        const passesAge = matchesAgeCategory(
          teamEntry.result.teamEntry,
          ageCategory,
          ageRef
        );
        const passesGender = matchesGenderCategory(
          teamEntry.result.teamEntry,
          genderCategory
        );

        if (!passesAge || !passesGender) {
          slots.push({
            regattaId: regatta.id,
            regattaName: regatta.name,
            regattaDate: regatta.startDate.toISOString(),
            starters: effectiveStartersByRegatta[regatta.id] ?? 0,
            finalRank: null,
            weightedScore: null,
            counted: false,
          });
          continue;
        }

        const starters = effectiveStartersByRegatta[regatta.id] ?? 0;
        const finalRank = germanOnly
          ? (germanRankMap[regatta.id]?.[helmId] ?? null)
          : teamEntry.result.finalRank;

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
        teamKey: `${helmId}::${team.primaryCrewId ?? "-"}`,
        crewIds: Array.from(team.crewIds),
        rank: null,
        qualiScore,
        regattaSlots: slots,
        validCount,
        splitFromSwap: team.splitFromSwap,
      });
    }
  }

  // Split into ranked (≥2 results) and preliminary (exactly 1 result)
  const ranked = rows.filter((r) => r.validCount >= 2);
  const preliminary = rows.filter((r) => r.validCount === 1);

  function tiebreakSort(a: JwmJemRow, b: JwmJemRow): number {
    const scoreDiff = a.qualiScore - b.qualiScore;
    if (Math.abs(scoreDiff) > 1e-10) return scoreDiff;

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

    return b.validCount - a.validCount;
  }

  ranked.sort(tiebreakSort);
  preliminary.sort(tiebreakSort);

  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  return { ranked, preliminary, maxStarters, startersByRegatta: effectiveStartersByRegatta };
}
