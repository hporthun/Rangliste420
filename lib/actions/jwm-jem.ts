/**
 * Server-Actions: JWM/JEM-Qualifikationsrangliste.
 *
 * Klassen-spezifische Sonderregel der 420er-KV (siehe
 * `docs/business-rules.md` §2.4 + §2.5). Anders als die DSV-Rangliste:
 * - 3 Regatten ausgewählt, beste 2 zählen
 * - Gewichteter Score: `finalRank × (maxStarters / startersThisRegatta)`
 * - `germanOnly: true` (nur GER-Helms)
 * - **Schottenwechsel-Regel**: pro Helm 1× genehmigter Wechsel; sonst
 *   Helm/Crew-Kombination = neues Team (siehe Scoring-Engine)
 *
 * Was hier lebt:
 * - `computeJwmJemAction` — live-Berechnung; gibt Display-Rows zurück
 *   inkl. Crew-Namen, teamKey (für React-Keys, da ein Helm mehrere Zeilen
 *   haben kann) und splitFromSwap-Flag
 * - `saveJwmJemAction` — persistiert die Quali als `Ranking` mit Type
 *   `JWM_QUALI` oder `JEM_QUALI` (s. `Ranking.type` in Schema)
 *
 * Schreibt in: `Ranking` + `RankingRegatta` (nur saveJwmJemAction).
 * Compute liest pure aus `Regatta`/`Result`/`TeamEntry`.
 *
 * Auth: `saveJwmJemAction` braucht Session, `computeJwmJemAction` ist
 * read-only (auch von public pages aufrufbar).
 */
"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { calculateJwmJemQuali } from "@/lib/scoring/jwm-jem-quali";
import type { AgeCategory, GenderCategory } from "@/lib/scoring/filters";
import type { RegattaData, ResultData } from "@/lib/scoring/dsv";
import { revalidatePath } from "next/cache";

// ── Params & result types ─────────────────────────────────────────────────────

export type JwmJemParams = {
  type: "JWM_QUALI" | "JEM_QUALI";
  regattaIds: string[];
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
  referenceDate: string; // ISO date string
};

export type JwmJemDisplayRow = {
  helmId: string;
  /**
   * Eindeutiger Schlüssel pro Team — ein Helm kann mehrere Zeilen haben,
   * wenn er in den ausgewählten Regatten mit verschiedenen Crews ohne
   * genehmigten Wechsel gefahren ist. Verwende diesen statt `helmId` als
   * React-key in der Tabelle.
   */
  teamKey: string;
  rank: number | null;
  firstName: string;
  lastName: string;
  club: string | null;
  qualiScore: number;
  validCount: number;
  /**
   * True wenn diese Zeile aus einem Team-Split entstanden ist, das durch
   * einen ungenehmigten Wechsel oder einen zweiten Wechsel ausgelöst wurde.
   * Die UI zeigt dann ein Hinweis-Icon „neues Team".
   */
  splitFromSwap: boolean;
  slots: {
    regattaId: string;
    finalRank: number | null;
    weightedScore: number | null;
    counted: boolean;
  }[];
  /**
   * Crews dieses Teams (1 oder 2 nach genehmigtem Swap), most-frequent first.
   * Anders als vor der JWM/JEM-Schottenwechsel-Regel enthält diese Liste nur
   * die Crews dieses Teams, nicht alle Crews des Helms in den Regatten.
   */
  crews: {
    id: string;
    firstName: string;
    lastName: string;
    count: number;
  }[];
};

export type JwmJemComputeResult = {
  ranked: JwmJemDisplayRow[];
  preliminary: JwmJemDisplayRow[];
  regattas: {
    id: string;
    name: string;
    startDate: string;
    starters: number;
  }[];
  maxStarters: number;
};

// ── DB fetch helper ───────────────────────────────────────────────────────────

async function fetchRegattasByIds(ids: string[]): Promise<RegattaData[]> {
  const regs = await db.regatta.findMany({
    where: { id: { in: ids } },
    include: {
      results: {
        include: { teamEntry: { include: { helm: true, crew: true } } },
      },
    },
  });

  // Preserve input order
  const regMap = new Map(regs.map((r) => [r.id, r]));

  return ids
    .filter((id) => regMap.has(id))
    .map((id) => {
      const reg = regMap.get(id)!;
      const results: ResultData[] = reg.results.map((r) => ({
        id: r.id,
        teamEntry: {
          helmId: r.teamEntry.helmId,
          crewId: r.teamEntry.crewId,
          helm: {
            id: r.teamEntry.helm.id,
            birthYear: r.teamEntry.helm.birthYear,
            gender: r.teamEntry.helm.gender,
          },
          crew: r.teamEntry.crew
            ? {
                id: r.teamEntry.crew.id,
                birthYear: r.teamEntry.crew.birthYear,
                gender: r.teamEntry.crew.gender,
              }
            : null,
          // Wird vom JWM/JEM-Quali-Scoring zur Team-Partitionierung benutzt
          crewSwapApproved: r.teamEntry.crewSwapApproved,
        },
        finalRank: r.finalRank,
        inStartArea: r.inStartArea,
      }));

      return {
        id: reg.id,
        name: reg.name,
        ranglistenFaktor: Number(reg.ranglistenFaktor),
        completedRaces: reg.completedRaces,
        multiDayAnnouncement: reg.multiDayAnnouncement,
        startDate: reg.startDate,
        totalStarters: reg.totalStarters,
        results,
      };
    });
}

// ── computeJwmJemAction ───────────────────────────────────────────────────────

export async function computeJwmJemAction(
  params: JwmJemParams
): Promise<{ ok: true; data: JwmJemComputeResult } | { ok: false; error: string }> {
  // Read-only computation — no auth required (data shown on public pages too)
  try {
    const { regattaIds, ageCategory, genderCategory, referenceDate } = params;

    if (regattaIds.length === 0) {
      return { ok: false, error: "Mindestens eine Regatta muss ausgewählt sein." };
    }
    if (regattaIds.length > 3) {
      return { ok: false, error: "Maximal 3 Regatten können ausgewählt werden." };
    }

    const regattas = await fetchRegattasByIds(regattaIds);

    // Collect all helm IDs to fetch nationalities
    const helmIds = [
      ...new Set(
        regattas.flatMap((reg) => reg.results.map((r) => r.teamEntry.helmId))
      ),
    ];

    const sailorNationalities = await db.sailor.findMany({
      where: { id: { in: helmIds } },
      select: { id: true, nationality: true },
    });
    const helmNationalities: Record<string, string> = Object.fromEntries(
      sailorNationalities.map((s) => [s.id, s.nationality])
    );

    const output = calculateJwmJemQuali({
      regattas,
      ageCategory,
      genderCategory,
      referenceDate: new Date(referenceDate),
      germanOnly: true,
      helmNationalities,
    });

    // Collect all helm IDs in output for display data
    const allOutputHelmIds = [
      ...output.ranked.map((r) => r.helmId),
      ...output.preliminary.map((r) => r.helmId),
    ];

    const sailors = await db.sailor.findMany({
      where: { id: { in: allOutputHelmIds } },
      select: { id: true, firstName: true, lastName: true, club: true },
    });
    const sailorMap = Object.fromEntries(sailors.map((s) => [s.id, s]));

    // Crew name lookup: gather all crew IDs that appear in the output rows.
    const allCrewIds = [
      ...new Set(
        [...output.ranked, ...output.preliminary]
          .flatMap((r) => r.crewIds)
          .filter((id): id is string => id !== null)
      ),
    ];
    const crewSailors = await db.sailor.findMany({
      where: { id: { in: allCrewIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const crewMap = Object.fromEntries(crewSailors.map((s) => [s.id, s]));

    // Per-team crew counts: how often did this specific team's primary or
    // approved-swap crew actually sail in the selected regattas? We derive
    // it from the row's slots (regattas where the team appears with a
    // weighted score = the team's actual sails) but we don't have crewId
    // back at this layer, so fall back to "1 occurrence per crew".
    function crewsForRow(
      crewIds: (string | null)[]
    ): JwmJemDisplayRow["crews"] {
      return crewIds
        .filter((id): id is string => id !== null)
        .map((id) => {
          const s = crewMap[id];
          return {
            id,
            firstName: s?.firstName ?? "?",
            lastName: s?.lastName ?? "?",
            count: 1,
          };
        })
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName, "de") ||
            a.firstName.localeCompare(b.firstName, "de")
        );
    }

    function toDisplayRow(row: (typeof output.ranked)[number]): JwmJemDisplayRow {
      const sailor = sailorMap[row.helmId];
      return {
        helmId: row.helmId,
        teamKey: row.teamKey,
        rank: row.rank,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        qualiScore: row.qualiScore,
        validCount: row.validCount,
        splitFromSwap: row.splitFromSwap,
        slots: row.regattaSlots.map((s) => ({
          regattaId: s.regattaId,
          finalRank: s.finalRank,
          weightedScore: s.weightedScore,
          counted: s.counted,
        })),
        crews: crewsForRow(row.crewIds),
      };
    }

    const regattaMetas = regattas.map((reg) => ({
      id: reg.id,
      name: reg.name,
      startDate: reg.startDate.toISOString(),
      starters: output.startersByRegatta[reg.id] ?? 0,
    }));

    return {
      ok: true,
      data: {
        ranked: output.ranked.map(toDisplayRow),
        preliminary: output.preliminary.map(toDisplayRow),
        regattas: regattaMetas,
        maxStarters: output.maxStarters,
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── saveJwmJemAction ──────────────────────────────────────────────────────────

export async function saveJwmJemAction(
  params: JwmJemParams,
  name: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Name darf nicht leer sein." };

  try {
    const { type, regattaIds, ageCategory, genderCategory, referenceDate } = params;

    if (regattaIds.length === 0) {
      return { ok: false, error: "Mindestens eine Regatta muss ausgewählt sein." };
    }
    if (regattaIds.length > 3) {
      return { ok: false, error: "Maximal 3 Regatten können ausgewählt werden." };
    }

    // Determine seasonStart from earliest regatta date
    const regattas = await db.regatta.findMany({
      where: { id: { in: regattaIds } },
      select: { startDate: true },
      orderBy: { startDate: "asc" },
    });

    if (regattas.length === 0) {
      return { ok: false, error: "Keine der ausgewählten Regatten gefunden." };
    }

    const seasonStart = regattas[0].startDate;
    const seasonEnd = new Date(referenceDate);

    const ranking = await db.ranking.create({
      data: {
        name: trimmedName,
        type,
        seasonStart,
        seasonEnd,
        ageCategory,
        genderCategory,
        scoringRule: JSON.stringify({ kind: "jwm_jem_quali", type }),
        isPublic: false,
        rankingRegattas: {
          create: regattaIds.map((id) => ({ regattaId: id })),
        },
      },
    });

    revalidatePath("/admin/ranglisten");
    return { ok: true, id: ranking.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
