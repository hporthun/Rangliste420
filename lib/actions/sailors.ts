"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { sailorSchema } from "@/lib/schemas/sailor";
import { revalidatePath } from "next/cache";
import { parseStammdaten } from "@/lib/import/parse-stammdaten";
import { findMatches } from "@/lib/import/matching";
import { toTitleCase } from "@/lib/import/normalize";

function parseInput(data: FormData | Record<string, unknown>) {
  const raw =
    data instanceof FormData
      ? Object.fromEntries(data.entries())
      : data;

  return sailorSchema.safeParse({
    ...raw,
    alternativeNames:
      typeof raw.alternativeNames === "string"
        ? JSON.parse(raw.alternativeNames || "[]")
        : (raw.alternativeNames ?? []),
    birthYear: raw.birthYear || null,
    gender: raw.gender || null,
    club: raw.club || null,
    sailingLicenseId: raw.sailingLicenseId || null,
  });
}

export async function createSailor(data: FormData) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  const parsed = parseInput(data);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };

  const { alternativeNames, ...rest } = parsed.data;

  const sailor = await db.sailor.create({
    data: {
      ...rest,
      firstName: toTitleCase(rest.firstName),
      lastName: toTitleCase(rest.lastName),
      alternativeNames: JSON.stringify(alternativeNames),
    },
  });

  revalidatePath("/admin/segler");
  return { ok: true as const, data: sailor };
}

export async function updateSailor(id: string, data: FormData) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  const parsed = parseInput(data);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };

  const { alternativeNames, ...rest } = parsed.data;

  const sailor = await db.sailor.update({
    where: { id },
    data: {
      ...rest,
      firstName: toTitleCase(rest.firstName),
      lastName: toTitleCase(rest.lastName),
      alternativeNames: JSON.stringify(alternativeNames),
    },
  });

  revalidatePath("/admin/segler");
  revalidatePath(`/admin/segler/${id}`);
  return { ok: true as const, data: sailor };
}

export async function deleteSailor(id: string) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  const usedAsHelm = await db.teamEntry.count({ where: { helmId: id } });
  const usedAsCrew = await db.teamEntry.count({ where: { crewId: id } });

  if (usedAsHelm + usedAsCrew > 0) {
    return {
      ok: false as const,
      error: "Segler kann nicht gelöscht werden – ist in Regatten eingetragen.",
    };
  }

  await db.sailor.delete({ where: { id } });
  revalidatePath("/admin/segler");
  return { ok: true as const };
}

// ── Stammdaten bulk import ─────────────────────────────────────────────────────

export type StammdatenPreviewRow = {
  externalId: number;
  lastName: string;
  firstName: string;
  birthYear: number | null;
  gender: "M" | "F" | null;
  matchedSailorId: string | null;
  matchedName: string | null;
  matchScore: number;
  /** "exact" | "fuzzy" | "none" */
  matchType: "exact" | "fuzzy" | "none";
  /** Whether the matched sailor already has these values set */
  alreadySet: { birthYear: boolean; gender: boolean };
};

export async function previewStammdatenAction(
  text: string
): Promise<{ ok: true; rows: StammdatenPreviewRow[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const parsed = parseStammdaten(text);
    if (parsed.length === 0) return { ok: false, error: "Keine Zeilen erkannt." };

    const sailors = await db.sailor.findMany({
      select: { id: true, firstName: true, lastName: true, birthYear: true, gender: true, alternativeNames: true, sailingLicenseId: true },
    });

    const rows: StammdatenPreviewRow[] = parsed.map((row) => {
      const matches = findMatches(row.firstName, row.lastName, null, sailors);
      const top = matches[0];
      let matchedSailorId: string | null = null;
      let matchedName: string | null = null;
      let matchScore = 0;
      let matchType: StammdatenPreviewRow["matchType"] = "none";

      if (top) {
        matchScore = top.score;
        matchedSailorId = top.candidate.id;
        matchedName = `${top.candidate.firstName} ${top.candidate.lastName}`;
        matchType = top.confidence === "high" ? "exact" : "fuzzy";
      }

      const matched = matchedSailorId ? sailors.find((s) => s.id === matchedSailorId) : null;
      return {
        ...row,
        matchedSailorId,
        matchedName,
        matchScore,
        matchType,
        alreadySet: {
          birthYear: matched ? matched.birthYear !== null : false,
          gender: matched ? matched.gender !== null : false,
        },
      };
    });

    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function applyStammdatenAction(
  updates: Array<{ sailorId: string; birthYear: number | null; gender: "M" | "F" | null }>
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    let count = 0;
    for (const u of updates) {
      const data: Record<string, unknown> = {};
      if (u.birthYear !== null) data.birthYear = u.birthYear;
      if (u.gender !== null) data.gender = u.gender;
      if (Object.keys(data).length === 0) continue;
      await db.sailor.update({ where: { id: u.sailorId }, data });
      count++;
    }
    revalidatePath("/admin/segler");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
