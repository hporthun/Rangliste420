/**
 * Server-Actions: DSV-Ranglisten (Jahres / Aktuelle / IDJM).
 *
 * Glue-Schicht zwischen UI-Pages und der Pure-Function-Scoring-Engine
 * (`lib/scoring/dsv.ts`, `lib/scoring/idjm-quali.ts`). Macht zwei Dinge:
 * 1. DB-Daten in das Scoring-Format mappen (`fetchRegattaData`)
 * 2. Berechnungs-Ergebnisse für die UI aufbereiten (Crew-Aggregation,
 *    Verein-/Sailor-Names, regatta-Metas mit `s` und Override-Marker)
 *
 * Was hier lebt:
 * - `computeRankingAction`    — live-Berechnung für JAHRESRANGLISTE /
 *                                AKTUELLE / IDJM. Dispatcht an
 *                                `calculateDsvRanking` oder
 *                                `calculateIdjmQuali`.
 * - `computeHelmDetailAction` — alle 9 R_A-Werte + Crew-Historie eines
 *                                einzelnen Helms (Transparenz-Detail-Seite)
 * - `saveRanklisteAction`     — JAHRESRANGLISTE oder IDJM persistieren
 * - `updateRanklisteAction`   — Edit-Flow für gespeicherte Ranglisten
 *                                (replace rankingRegattas in transaction)
 * - `getRankingForEditAction` — saved Ranking → ComputeParams für vorschau
 * - `deleteRankingAction`, `renameRankingAction`, `publishRankingAction`
 * - `saveJahresranklisteAction` — Backward-Compat-Alias für
 *                                  `saveRanklisteAction` (alte UI-Pfade)
 *
 * Wichtige Invarianten:
 * - **AKTUELLE** wird nie persistiert (Whitelist `SAVEABLE_TYPES`)
 * - `s` in der Formel = `regatta.totalStarters ?? regatta.results.length`
 *   (siehe Engine; hier nur durchgereicht)
 * - **Foreign Boats**: kein Nationalitäts-Filter auf Helm-Seite —
 *   ausländische Helms erscheinen, wenn sie ≥ 9 Wertungen haben
 *
 * Schreibt in: `Ranking` + `RankingRegatta`. Compute liest pure aus
 * Regatten/Results.
 *
 * Auth: Save/Update/Delete/Rename/Publish brauchen Session;
 * Compute-Actions sind read-only (auch von public pages benutzbar).
 */
"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { calculateDsvRanking } from "@/lib/scoring/dsv";
import { calculateIdjmQuali } from "@/lib/scoring/idjm-quali";
import type { RegattaData, AgeCategory, GenderCategory, HelmRanking } from "@/lib/scoring/dsv";
import { revalidatePath } from "next/cache";
import { broadcastPush } from "@/lib/push/notify";

// ── DB → scoring types ────────────────────────────────────────────────────────

async function fetchRegattaData(
  where: { isRanglistenRegatta: boolean; startDate: { gte: Date; lte: Date } }
): Promise<RegattaData[]> {
  const regs = await db.regatta.findMany({
    where,
    include: {
      results: {
        include: { teamEntry: { include: { helm: true, crew: true } } },
      },
    },
  });

  return regs.map((reg) => ({
    id: reg.id,
    name: reg.name,
    ranglistenFaktor: Number(reg.ranglistenFaktor),
    completedRaces: reg.completedRaces,
    multiDayAnnouncement: reg.multiDayAnnouncement,
    startDate: reg.startDate,
    totalStarters: reg.totalStarters,
    results: reg.results.map((r) => ({
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
      },
      finalRank: r.finalRank,
      inStartArea: r.inStartArea,
    })),
  }));
}

// ── Display types ─────────────────────────────────────────────────────────────

/**
 * Crew member used by a helm during the ranking period, with count of how
 * many regattas they sailed together in. Issue #31: rankings now expose the
 * crew name(s) so users can see at a glance who sailed in each boat —
 * before, only the helm was visible.
 */
export type CrewEntry = {
  id: string;
  firstName: string;
  lastName: string;
  /** Number of season regattas this crew sailed with this helm. */
  count: number;
};

export type RankingRow = {
  rank: number;
  helmId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  R: number;
  valuesCount: number;
  /**
   * All crews used by this helm during the season, ordered most-frequent
   * first. Empty array if the helm only sailed PDF-imported regattas
   * (where crew is unknown). UI typically shows the first one inline and
   * indicates +N when there are more.
   */
  crews: CrewEntry[];
};

export type RegattaMeta = {
  id: string;
  name: string;
  startDate: string;
  ranglistenFaktor: number;
  completedRaces: number;
  /**
   * Effektive Anzahl gestarteter Boote, die in der R_A-Formel als `s`
   * verwendet wurde — entweder das auf der Regatta gepflegte
   * `totalStarters`-Feld oder, als Fallback, die Anzahl tatsächlich
   * importierter Ergebnisse.
   */
  starters: number;
  /** Wahr, wenn `starters` aus dem manuell gepflegten totalStarters-Feld
   *  kommt (statt aus der Anzahl importierter Ergebnisse). */
  startersFromOverride: boolean;
};

export type RankingComputeResult = {
  rows: RankingRow[];
  regattas: RegattaMeta[];
};

export type RankingType = "JAHRESRANGLISTE" | "AKTUELLE" | "IDJM";

export type ComputeParams = {
  type: RankingType;
  /** ISO date — first day of the period (Von) */
  seasonStart: string;
  /** ISO date — last day of the period / Stichtag (Bis) */
  referenceDate: string;
  ageCategory: AgeCategory;
  genderCategory: GenderCategory;
};

// ── Compute action ────────────────────────────────────────────────────────────

export async function computeRankingAction(
  params: ComputeParams
): Promise<{ ok: true; data: RankingComputeResult } | { ok: false; error: string }> {
  // Read-only computation — no auth required (data shown on public pages too)
  try {
    const { type, seasonStart: seasonStartStr, referenceDate, ageCategory, genderCategory } = params;
    const refDate = new Date(referenceDate);
    const seasonStart = new Date(seasonStartStr);
    const seasonYear = refDate.getFullYear();

    const regattas = await fetchRegattaData({
      isRanglistenRegatta: true,
      startDate: { gte: seasonStart, lte: refDate },
    });

    let rankings: HelmRanking[];
    if (type === "IDJM") {
      if (ageCategory !== "U19" && ageCategory !== "U16") {
        return { ok: false, error: "IDJM-Quali ist nur für U19 und U16 verfügbar." };
      }
      const result = calculateIdjmQuali({
        ageCategory: ageCategory as "U19" | "U16",
        genderCategory,
        regattas,
      });
      rankings = result.rankings;
    } else {
      const result = calculateDsvRanking({
        seasonYear,
        ageCategory,
        genderCategory,
        referenceDate: refDate,
        regattas,
      });
      rankings = result.rankings;
    }

    // Fetch sailor names
    const helmIds = rankings.map((r) => r.helmId);
    const sailors = await db.sailor.findMany({
      where: { id: { in: helmIds } },
      select: { id: true, firstName: true, lastName: true, club: true },
    });
    const sailorMap = Object.fromEntries(sailors.map((s) => [s.id, s]));

    // Issue #31: aggregate the crew(s) each helm sailed with during the
    // season. One DB query covers all helms in scope; we group in memory.
    const teamEntriesWithCrew = await db.teamEntry.findMany({
      where: {
        helmId: { in: helmIds },
        regatta: {
          isRanglistenRegatta: true,
          startDate: { gte: seasonStart, lte: refDate },
        },
        crewId: { not: null },
      },
      select: {
        helmId: true,
        crewId: true,
        crew: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    type CrewMap = Map<string, { firstName: string; lastName: string; count: number }>;
    const helmCrews = new Map<string, CrewMap>();
    for (const te of teamEntriesWithCrew) {
      if (!te.crew) continue;
      const map = helmCrews.get(te.helmId) ?? new Map();
      const existing = map.get(te.crew.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(te.crew.id, {
          firstName: te.crew.firstName,
          lastName: te.crew.lastName,
          count: 1,
        });
      }
      helmCrews.set(te.helmId, map);
    }

    function crewsFor(helmId: string): CrewEntry[] {
      const map = helmCrews.get(helmId);
      if (!map) return [];
      return Array.from(map.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort(
          (a, b) =>
            b.count - a.count ||
            a.lastName.localeCompare(b.lastName, "de") ||
            a.firstName.localeCompare(b.firstName, "de")
        );
    }

    const rows: RankingRow[] = rankings.map((r) => {
      const sailor = sailorMap[r.helmId];
      return {
        rank: r.rank,
        helmId: r.helmId,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        R: r.R,
        valuesCount: r.allValues.length,
        crews: crewsFor(r.helmId),
      };
    });

    const regattaMetas: RegattaMeta[] = regattas.map((reg) => {
      const override = reg.totalStarters != null;
      return {
        id: reg.id,
        name: reg.name,
        startDate: reg.startDate.toISOString(),
        ranglistenFaktor: reg.ranglistenFaktor,
        completedRaces: reg.completedRaces,
        starters: override ? reg.totalStarters! : reg.results.length,
        startersFromOverride: override,
      };
    });

    return { ok: true, data: { rows, regattas: regattaMetas } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Helm detail ───────────────────────────────────────────────────────────────

export type ValueDetail = {
  regattaId: string;
  regattaName: string;
  regattaDate: string;
  f: number;
  s: number;
  x: number | null;
  rA: number;
  m: number;
  multiplierIndex: number;
  inStartArea: boolean;
};

export type HelmDetailData = {
  helmId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  rank: number;
  R: number;
  top9: ValueDetail[];
  nonContributing: ValueDetail[];
  crewHistory: Array<{
    regattaId: string;
    regattaName: string;
    regattaDate: string;
    crewId: string | null;
    crewFirstName: string | null;
    crewLastName: string | null;
    sailNumber: string | null;
  }>;
};

export async function computeHelmDetailAction(
  params: ComputeParams,
  helmId: string
): Promise<{ ok: true; data: HelmDetailData } | { ok: false; error: string }> {
  // Read-only computation — no auth required (data shown on public pages too)
  try {
    const { type, seasonStart: seasonStartStr, referenceDate, ageCategory, genderCategory } = params;
    const refDate = new Date(referenceDate);
    const seasonStart = new Date(seasonStartStr);
    const seasonYear = refDate.getFullYear();

    const dbRegattas = await db.regatta.findMany({
      where: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } },
      include: {
        results: {
          include: { teamEntry: { include: { helm: true, crew: true } } },
        },
      },
    });

    const regattas = dbRegattas.map((reg) => ({
      id: reg.id,
      name: reg.name,
      ranglistenFaktor: Number(reg.ranglistenFaktor),
      completedRaces: reg.completedRaces,
      multiDayAnnouncement: reg.multiDayAnnouncement,
      startDate: reg.startDate,
      totalStarters: reg.totalStarters,
      results: reg.results.map((r) => ({
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
        },
        finalRank: r.finalRank,
        inStartArea: r.inStartArea,
      })),
    }));

    // Build a regatta name map
    const regattaNameMap = Object.fromEntries(
      dbRegattas.map((r) => [r.id, { name: r.name, date: r.startDate.toISOString() }])
    );

    let rankings: HelmRanking[];
    if (type === "IDJM") {
      if (ageCategory !== "U19" && ageCategory !== "U16") {
        return { ok: false, error: "IDJM nur für U19/U16." };
      }
      rankings = calculateIdjmQuali({ ageCategory: ageCategory as "U19" | "U16", genderCategory, regattas }).rankings;
    } else {
      rankings = calculateDsvRanking({ seasonYear, ageCategory, genderCategory, referenceDate: refDate, regattas }).rankings;
    }

    const entry = rankings.find((r) => r.helmId === helmId);
    if (!entry) return { ok: false, error: "Kein Ranglisten-Eintrag für diesen Segler." };

    const sailor = await db.sailor.findUnique({
      where: { id: helmId },
      select: { firstName: true, lastName: true, club: true },
    });

    function toDetail(v: HelmRanking["top9"][number]): ValueDetail {
      const reg = regattaNameMap[v.regattaId];
      return {
        regattaId: v.regattaId,
        regattaName: reg?.name ?? v.regattaId,
        regattaDate: reg?.date ?? "",
        f: v.f,
        s: v.s,
        x: v.x,
        rA: v.value,
        m: v.m,
        multiplierIndex: v.multiplierIndex,
        inStartArea: v.inStartArea,
      };
    }

    // Crew history from DB (all teamEntries for this helm in the season)
    const teamEntries = await db.teamEntry.findMany({
      where: {
        helmId,
        regatta: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } }, // seasonStart is already a Date here
      },
      include: {
        crew: { select: { firstName: true, lastName: true } },
        regatta: { select: { id: true, name: true, startDate: true } },
      },
      orderBy: { regatta: { startDate: "asc" } },
    });

    const crewHistory = teamEntries.map((te) => ({
      regattaId: te.regatta.id,
      regattaName: te.regatta.name,
      regattaDate: te.regatta.startDate.toISOString(),
      crewId: te.crewId,
      crewFirstName: te.crew?.firstName ?? null,
      crewLastName: te.crew?.lastName ?? null,
      sailNumber: te.sailNumber,
    }));

    return {
      ok: true,
      data: {
        helmId,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        rank: entry.rank,
        R: entry.R,
        top9: entry.top9.map(toDetail),
        nonContributing: entry.allValues.slice(9).map(toDetail),
        crewHistory,
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Save / update ranking ─────────────────────────────────────────────────────

/** Which compute-types may be persisted as a Ranking row. */
const SAVEABLE_TYPES = new Set<RankingType>(["JAHRESRANGLISTE", "IDJM"]);

export async function saveRanklisteAction(
  name: string,
  params: ComputeParams,
  regattaIds: string[]
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (!SAVEABLE_TYPES.has(params.type)) {
    return {
      ok: false,
      error:
        "Diese Ranglisten-Art (Aktuelle Rangliste) wird immer live berechnet und kann nicht gespeichert werden.",
    };
  }
  try {
    const ranking = await db.ranking.create({
      data: {
        name,
        // Issue #28: IDJM-Quali kann jetzt ebenfalls gespeichert werden.
        // Stored type matches the compute type; "AKTUELLE" never reaches
        // here (gated above).
        type: params.type,
        seasonStart: new Date(params.seasonStart),
        seasonEnd: new Date(params.referenceDate),
        ageCategory: params.ageCategory,
        genderCategory: params.genderCategory,
        scoringRule: JSON.stringify({ scoringType: "dsv_standard", ...params }),
        isPublic: false,
        rankingRegattas: {
          create: regattaIds.map((id) => ({ regattaId: id })),
        },
      },
    });
    revalidatePath("/admin/ranglisten");
    return { ok: true, data: { id: ranking.id } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Update a saved ranking's parameters and refresh its associated regattas.
 * Used by the "Rangliste bearbeiten" flow (Issue #26): user adjusts type,
 * dates or categories on the vorschau page, the new regatta set is
 * recomputed, and the existing Ranking row is mutated in place.
 */
export async function updateRanklisteAction(
  id: string,
  name: string,
  params: ComputeParams,
  regattaIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  if (!SAVEABLE_TYPES.has(params.type)) {
    return {
      ok: false,
      error: "Aktuelle Rangliste kann nicht persistiert werden.",
    };
  }
  try {
    await db.$transaction([
      // Replace the regatta set in one shot
      db.rankingRegatta.deleteMany({ where: { rankingId: id } }),
      db.ranking.update({
        where: { id },
        data: {
          name,
          type: params.type,
          seasonStart: new Date(params.seasonStart),
          seasonEnd: new Date(params.referenceDate),
          ageCategory: params.ageCategory,
          genderCategory: params.genderCategory,
          scoringRule: JSON.stringify({ scoringType: "dsv_standard", ...params }),
          rankingRegattas: {
            create: regattaIds.map((rid) => ({ regattaId: rid })),
          },
        },
      }),
    ]);
    revalidatePath("/admin/ranglisten");
    revalidatePath(`/rangliste/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Backwards-compat alias for {@link saveRanklisteAction}. Old form code
 * still imports this name; remove once the form is fully migrated. */
export const saveJahresranklisteAction = saveRanklisteAction;

/**
 * Load a saved ranking together with the ComputeParams that produced it.
 * Used to pre-fill the vorschau form when the user clicks "Bearbeiten".
 */
export async function getRankingForEditAction(
  id: string
): Promise<
  | { ok: true; data: { id: string; name: string; params: ComputeParams } }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const r = await db.ranking.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      seasonStart: true,
      seasonEnd: true,
      ageCategory: true,
      genderCategory: true,
    },
  });
  if (!r) return { ok: false, error: "Rangliste nicht gefunden." };
  return {
    ok: true,
    data: {
      id: r.id,
      name: r.name,
      params: {
        type: r.type as RankingType,
        seasonStart: r.seasonStart.toISOString().slice(0, 10),
        referenceDate: r.seasonEnd.toISOString().slice(0, 10),
        ageCategory: r.ageCategory as AgeCategory,
        genderCategory: r.genderCategory as GenderCategory,
      },
    },
  };
}

export async function deleteRankingAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    await db.ranking.delete({ where: { id } });
    revalidatePath("/admin/ranglisten");
    revalidatePath(`/rangliste/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function renameRankingAction(
  id: string,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name darf nicht leer sein." };
  try {
    await db.ranking.update({ where: { id }, data: { name: trimmed } });
    revalidatePath("/admin/ranglisten");
    revalidatePath(`/rangliste/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function publishRankingAction(
  id: string,
  isPublic: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const before = await db.ranking.findUnique({
      where: { id },
      select: { isPublic: true, name: true },
    });
    const ranking = await db.ranking.update({
      where: { id },
      data: { isPublic, publishedAt: isPublic ? new Date() : null },
      select: { name: true },
    });
    revalidatePath("/admin/ranglisten");
    revalidatePath(`/rangliste/${id}`);

    // Broadcast nur, wenn die Rangliste neu auf "public" geht — Re-Veröffentlichen
    // einer schon sichtbaren oder das Zurücknehmen löst keinen Push aus.
    if (isPublic && before && !before.isPublic) {
      await broadcastPush({
        title: "Neue Rangliste verfügbar",
        body: ranking.name,
        url: `/rangliste/${id}`,
        count: 1,
        tag: `ranking:${id}`,
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
