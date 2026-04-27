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
  rank: number | null;
  firstName: string;
  lastName: string;
  club: string | null;
  qualiScore: number;
  validCount: number;
  slots: {
    regattaId: string;
    finalRank: number | null;
    weightedScore: number | null;
    counted: boolean;
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

    function toDisplayRow(row: (typeof output.ranked)[number]): JwmJemDisplayRow {
      const sailor = sailorMap[row.helmId];
      return {
        helmId: row.helmId,
        rank: row.rank,
        firstName: sailor?.firstName ?? "?",
        lastName: sailor?.lastName ?? "?",
        club: sailor?.club ?? null,
        qualiScore: row.qualiScore,
        validCount: row.validCount,
        slots: row.regattaSlots.map((s) => ({
          regattaId: s.regattaId,
          finalRank: s.finalRank,
          weightedScore: s.weightedScore,
          counted: s.counted,
        })),
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
