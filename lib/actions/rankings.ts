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
import type {
  RegattaData,
  AgeCategory,
  GenderCategory,
  HelmRanking,
  BelowCutoffEntry,
} from "@/lib/scoring/dsv";
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
  /** Primary sailor: helmId in HELM mode, crewId in CREW mode */
  sailorId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  R: number;
  valuesCount: number;
  /**
   * Partner sailors: crews in HELM mode, helms in CREW mode.
   * Ordered most-frequent first.
   */
  partners: CrewEntry[];
  /** True wenn das Geburtsjahr im Sailor-Stammdatensatz fehlt (Issue #52). */
  birthYearMissing: boolean;
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

/**
 * Segler mit Wertungen, aber unter dem 9-Werte-Cutoff der DSV-Rangliste.
 * Wird auf der Detailseite als "Noch nicht in der Wertung" gezeigt, damit
 * Trainer/Segler sehen, wie weit sie noch sind und wer ihre Crew war.
 */
export type BelowCutoffRow = {
  sailorId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  valuesCount: number;
  partners: CrewEntry[];
  birthYearMissing: boolean;
};

export type RankingComputeResult = {
  rows: RankingRow[];
  belowCutoff: BelowCutoffRow[];
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
  /** "HELM" (default) or "CREW" — group ranking by Steuermann or Vorschoter */
  scoringUnit?: "HELM" | "CREW";
};

// ── Compute action ────────────────────────────────────────────────────────────

export async function computeRankingAction(
  params: ComputeParams
): Promise<{ ok: true; data: RankingComputeResult } | { ok: false; error: string }> {
  // Read-only computation — no auth required (data shown on public pages too)
  try {
    const { type, seasonStart: seasonStartStr, referenceDate, ageCategory, genderCategory, scoringUnit = "HELM" } = params;
    const refDate = new Date(referenceDate);
    const seasonStart = new Date(seasonStartStr);
    const seasonYear = refDate.getFullYear();

    const regattas = await fetchRegattaData({
      isRanglistenRegatta: true,
      startDate: { gte: seasonStart, lte: refDate },
    });

    let rankings: HelmRanking[];
    let belowCutoff: BelowCutoffEntry[];
    if (type === "IDJM") {
      // Issue #53: Alle Altersklassen (inkl. OPEN/U22) sind für IDJM-Quali zulässig.
      const result = calculateIdjmQuali({
        ageCategory,
        genderCategory,
        regattas,
        referenceDate: refDate,
        scoringUnit,
      });
      rankings = result.rankings;
      belowCutoff = result.belowCutoff;
    } else {
      const result = calculateDsvRanking({
        seasonYear,
        ageCategory,
        genderCategory,
        referenceDate: refDate,
        regattas,
        scoringUnit,
      });
      rankings = result.rankings;
      belowCutoff = result.belowCutoff;
    }

    // Fetch sailor names for the primary scoring unit (rankings + below-cutoff)
    const sailorIds = Array.from(
      new Set([...rankings.map((r) => r.sailorId), ...belowCutoff.map((b) => b.sailorId)])
    );
    const sailors = await db.sailor.findMany({
      where: { id: { in: sailorIds } },
      select: { id: true, firstName: true, lastName: true, club: true, birthYear: true },
    });
    const sailorMap = Object.fromEntries(sailors.map((s) => [s.id, s]));

    // Aggregate partner sailors (crew→helm in CREW mode, helm→crew in HELM mode)
    type PartnerMap = Map<string, { firstName: string; lastName: string; count: number }>;
    const sailorPartners = new Map<string, PartnerMap>();

    if (scoringUnit === "CREW") {
      const teamEntriesWithHelm = await db.teamEntry.findMany({
        where: {
          crewId: { in: sailorIds },
          regatta: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } },
        },
        select: {
          crewId: true,
          helmId: true,
          helm: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      for (const te of teamEntriesWithHelm) {
        if (!te.crewId) continue;
        const map = sailorPartners.get(te.crewId) ?? new Map();
        const existing = map.get(te.helm.id);
        if (existing) existing.count += 1;
        else map.set(te.helm.id, { firstName: te.helm.firstName, lastName: te.helm.lastName, count: 1 });
        sailorPartners.set(te.crewId, map);
      }
    } else {
      const teamEntriesWithCrew = await db.teamEntry.findMany({
        where: {
          helmId: { in: sailorIds },
          regatta: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } },
          crewId: { not: null },
        },
        select: {
          helmId: true,
          crewId: true,
          crew: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      for (const te of teamEntriesWithCrew) {
        if (!te.crew) continue;
        const map = sailorPartners.get(te.helmId) ?? new Map();
        const existing = map.get(te.crew.id);
        if (existing) existing.count += 1;
        else map.set(te.crew.id, { firstName: te.crew.firstName, lastName: te.crew.lastName, count: 1 });
        sailorPartners.set(te.helmId, map);
      }
    }

    function partnersFor(sailorId: string): CrewEntry[] {
      const map = sailorPartners.get(sailorId);
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
      const sailor = sailorMap[r.sailorId];
      return {
        rank: r.rank,
        sailorId: r.sailorId,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        R: r.R,
        valuesCount: r.allValues.length,
        partners: partnersFor(r.sailorId),
        birthYearMissing: sailor?.birthYear == null,
      };
    });

    const belowCutoffRows: BelowCutoffRow[] = belowCutoff.map((b) => {
      const sailor = sailorMap[b.sailorId];
      return {
        sailorId: b.sailorId,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        valuesCount: b.valuesCount,
        partners: partnersFor(b.sailorId),
        birthYearMissing: sailor?.birthYear == null,
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

    return { ok: true, data: { rows, belowCutoff: belowCutoffRows, regattas: regattaMetas } };
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
  /** Primary sailor: helmId in HELM mode, crewId in CREW mode */
  sailorId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  rank: number;
  R: number;
  top9: ValueDetail[];
  nonContributing: ValueDetail[];
  /** Partner history: crew entries in HELM mode, helm entries in CREW mode */
  partnerHistory: Array<{
    regattaId: string;
    regattaName: string;
    regattaDate: string;
    partnerId: string | null;
    partnerFirstName: string | null;
    partnerLastName: string | null;
    sailNumber: string | null;
  }>;
};

export async function computeHelmDetailAction(
  params: ComputeParams,
  helmId: string
): Promise<{ ok: true; data: HelmDetailData } | { ok: false; error: string }> {
  // Read-only computation — no auth required (data shown on public pages too)
  try {
    const { type, seasonStart: seasonStartStr, referenceDate, ageCategory, genderCategory, scoringUnit = "HELM" } = params;
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
      // Issue #53: Alle Altersklassen (inkl. OPEN/U22) sind für IDJM-Quali zulässig.
      rankings = calculateIdjmQuali({ ageCategory, genderCategory, regattas, referenceDate: refDate, scoringUnit }).rankings;
    } else {
      rankings = calculateDsvRanking({ seasonYear, ageCategory, genderCategory, referenceDate: refDate, regattas, scoringUnit }).rankings;
    }

    const entry = rankings.find((r) => r.sailorId === helmId);
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

    // Partner history: in HELM mode = crews sailed with; in CREW mode = helms sailed with
    let partnerHistory: HelmDetailData["partnerHistory"];
    if (scoringUnit === "CREW") {
      const teamEntries = await db.teamEntry.findMany({
        where: {
          crewId: helmId,
          regatta: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } },
        },
        include: {
          helm: { select: { id: true, firstName: true, lastName: true } },
          regatta: { select: { id: true, name: true, startDate: true } },
        },
        orderBy: { regatta: { startDate: "asc" } },
      });
      partnerHistory = teamEntries.map((te) => ({
        regattaId: te.regatta.id,
        regattaName: te.regatta.name,
        regattaDate: te.regatta.startDate.toISOString(),
        partnerId: te.helmId,
        partnerFirstName: te.helm.firstName,
        partnerLastName: te.helm.lastName,
        sailNumber: te.sailNumber,
      }));
    } else {
      const teamEntries = await db.teamEntry.findMany({
        where: {
          helmId,
          regatta: { isRanglistenRegatta: true, startDate: { gte: seasonStart, lte: refDate } },
        },
        include: {
          crew: { select: { id: true, firstName: true, lastName: true } },
          regatta: { select: { id: true, name: true, startDate: true } },
        },
        orderBy: { regatta: { startDate: "asc" } },
      });
      partnerHistory = teamEntries.map((te) => ({
        regattaId: te.regatta.id,
        regattaName: te.regatta.name,
        regattaDate: te.regatta.startDate.toISOString(),
        partnerId: te.crewId,
        partnerFirstName: te.crew?.firstName ?? null,
        partnerLastName: te.crew?.lastName ?? null,
        sailNumber: te.sailNumber,
      }));
    }

    return {
      ok: true,
      data: {
        sailorId: helmId,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        rank: entry.rank,
        R: entry.R,
        top9: entry.top9.map(toDetail),
        nonContributing: entry.allValues.slice(9).map(toDetail),
        partnerHistory,
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
        scoringUnit: params.scoringUnit ?? "HELM",
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
          scoringUnit: params.scoringUnit ?? "HELM",
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
      scoringUnit: true,
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
        scoringUnit: (r.scoringUnit ?? "HELM") as "HELM" | "CREW",
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

export async function updateRankingsSortOrderAction(
  updates: { id: string; sortOrder: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    await db.$transaction(
      updates.map(({ id, sortOrder }) =>
        db.ranking.update({ where: { id }, data: { sortOrder } })
      )
    );
    revalidatePath("/admin/ranglisten");
    revalidatePath("/rangliste");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
