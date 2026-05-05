/**
 * JWM/JEM-Qualifikationsrangliste — klassenspezifische Sonderregel.
 * Quelle: 420er-Klassenvereinigung (https://420class.de/index.php/sport/quali)
 * Gültig für Saison 2026.
 *
 * Regel:
 * - Bis zu 4 Regatten werden ausgewählt.
 * - Gewichteter Platz: weightedScore = finalRank × (maxStarters / thisRegattaStarters)
 * - qualiScore = Summe der 2 besten (niedrigsten) weightedScores
 * - ≥ 2 Ergebnisse → Hauptrangliste (qualiScore aufsteigend)
 * - genau 1 Ergebnis → "Vorläufig / Zwischenergebnis"
 * - 0 Ergebnisse → nicht angezeigt
 * - Tiebreak: 1) niedrigster bester einzelner weightedScore, 2) mehr Regatten teilgenommen
 *
 * Schottenwechsel-Regel (User-Klarstellung 2026-04-29):
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
 * Zusatzregel (User-Klarstellung 2026-05-01):
 *   Teams, die einen nicht genehmigten Wechsel vorgenommen haben, werden
 *   bei der **entsprechenden Regatta** (der Wechsel-Regatta) weder mit
 *   ihrer Platzierung noch in der Teilnehmerzahl berücksichtigt.
 *   D.h. der erste Eintrag eines per ungenehmigtem Wechsel entstandenen
 *   neuen Teams wird komplett ausgeschlossen (weightedScore = null,
 *   starters für diese Regatta −1).
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
  /**
   * Regatta-ID, bei der ein ungenehmigter Schottenwechsel stattfand und der
   * Eintrag deshalb aus der Wertung ausgeschlossen wurde. null wenn kein
   * ungenehmigter Wechsel zugrunde liegt. Wird genutzt, um Teams in der
   * `excludedSwap`-Sektion mit Hinweis auf die betreffende Regatta darzustellen.
   */
  excludedSwapRegattaId: string | null;
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
  /**
   * Teams, deren einzige Regatta-Teilnahme durch einen ungenehmigten
   * Schottenwechsel ausgeschlossen wurde (validCount = 0,
   * excludedSwapRegattaId !== null). Werden in der UI unten ohne Wertung
   * geführt, damit nachvollziehbar bleibt, welche Helm/Crew-Kombi den Wechsel
   * vorgenommen hat.
   */
  excludedSwap: JwmJemRow[];
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
  /**
   * Regatta-ID, bei der ein nicht genehmigter Schottenwechsel stattfand.
   * Der Eintrag für diese Regatta wird von der Wertung ausgeschlossen
   * (finalRank/weightedScore = null) und nicht in der Teilnehmerzahl gezählt.
   */
  unapprovedSwapAtRegattaId: string | null;
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

  function startNewTeam(
    e: HelmEntry,
    splitFromSwap: boolean,
    unapprovedSwapAtRegattaId: string | null = null
  ): Team {
    return {
      helmId,
      primaryCrewId: e.crewId,
      crewIds: new Set([e.crewId]),
      swapUsed: false,
      entries: [e],
      splitFromSwap,
      unapprovedSwapAtRegattaId,
    };
  }

  let current: Team = startNewTeam(sorted[0], false);

  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];

    // Same crew as one of the team's accepted crews? → continue the team.
    // null crewId means "crew unknown" (e.g. PDF import) — treat as same team.
    if (current.crewIds.has(e.crewId) || e.crewId === null) {
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

    // Primary crew was null (unknown, e.g. PDF import), but now we have a
    // real crewId → adopt it without consuming the swap allowance.
    if (current.primaryCrewId === null && e.crewId !== null) {
      current.crewIds.delete(null);
      current.crewIds.add(e.crewId);
      current.primaryCrewId = e.crewId;
      current.entries.push(e);
      continue;
    }

    // Otherwise: close the current team and start a new one.
    // If the split was due to an unapproved swap, mark the first entry of the
    // new team so it is excluded from scoring and starters counts.
    const unapprovedSwapAtRegattaId = !e.crewSwapApproved ? e.regatta.id : null;
    teams.push(current);
    current = startNewTeam(e, true, unapprovedSwapAtRegattaId);
  }
  teams.push(current);
  return teams;
}

export function calculateJwmJemQuali(input: JwmJemInput): JwmJemOutput {
  const { regattas, ageCategory, genderCategory, referenceDate, germanOnly, helmNationalities } =
    input;

  // ── Build per-helm entry list ──────────────────────────────────────────────
  // Must happen before starters computation so we can identify unapproved-swap
  // entries that need to be excluded from the starters count.
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

  // ── Partition teams; collect unapproved-swap entry keys ───────────────────
  // unapprovedSwapKeys: `${helmId}::${regattaId}` for every entry that is the
  // first appearance of a team created by an unapproved crew change.
  // Those entries are excluded from starters counts AND from the team's scores.
  const teamsByHelm = new Map<string, Team[]>();
  const unapprovedSwapKeys = new Set<string>();

  for (const [helmId, entries] of helmEntries) {
    if (germanOnly && helmNationalities[helmId] !== "GER") continue;

    const teams = partitionTeams(entries);

    for (const team of teams) {
      if (team.unapprovedSwapAtRegattaId) {
        unapprovedSwapKeys.add(`${helmId}::${team.unapprovedSwapAtRegattaId}`);
      }
    }

    teamsByHelm.set(helmId, teams);
  }

  // ── Starters per regatta (excluding unapproved-swap entries) ─────────────
  const startersByRegatta: Record<string, number> = {};
  for (const regatta of regattas) {
    startersByRegatta[regatta.id] = regatta.results.filter(
      (r) =>
        r.finalRank !== null &&
        !unapprovedSwapKeys.has(`${r.teamEntry.helmId}::${regatta.id}`)
    ).length;
  }

  // ── German-only re-ranking (also excluding unapproved-swap entries) ───────
  const germanStartersByRegatta: Record<string, number> = {};
  const germanRankMap: Record<string, Record<string, number>> = {};

  if (germanOnly) {
    for (const regatta of regattas) {
      const germanResults = regatta.results
        .filter(
          (r) =>
            r.finalRank !== null &&
            helmNationalities[r.teamEntry.helmId] === "GER" &&
            !unapprovedSwapKeys.has(`${r.teamEntry.helmId}::${regatta.id}`)
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

  // ── Build per-team rows ───────────────────────────────────────────────────
  const rows: JwmJemRow[] = [];

  for (const [helmId, teams] of teamsByHelm) {
    for (const team of teams) {
      const slots: JwmJemRegattaSlot[] = [];

      for (const regatta of regattas) {
        // Unapproved-swap entry for this team at this regatta → fully excluded
        if (team.unapprovedSwapAtRegattaId === regatta.id) {
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

        // Age check uses the season's Stichtag (referenceDate), not the regatta date.
        const passesAge = matchesAgeCategory(
          teamEntry.result.teamEntry,
          ageCategory,
          referenceDate
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
        excludedSwapRegattaId: team.unapprovedSwapAtRegattaId,
      });
    }
  }

  // Split into ranked (≥2 results), preliminary (exactly 1 result), and
  // excludedSwap (validCount = 0 because the team's only entry was the
  // ungenehmigte-Wechsel-Eintrag, which is excluded from scoring).
  const ranked = rows.filter((r) => r.validCount >= 2);
  const preliminary = rows.filter((r) => r.validCount === 1);
  const excludedSwap = rows.filter(
    (r) => r.validCount === 0 && r.excludedSwapRegattaId !== null
  );

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

  // Stabile Sortierung der excludedSwap-Zeilen nach Helm/Crew-Namen wird vom
  // Caller (Display-Layer) gemacht — hier nur Wechsel-Datum/Helm-ID, damit
  // die Reihenfolge deterministisch ist.
  excludedSwap.sort((a, b) => a.teamKey.localeCompare(b.teamKey));

  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  return {
    ranked,
    preliminary,
    excludedSwap,
    maxStarters,
    startersByRegatta: effectiveStartersByRegatta,
  };
}
