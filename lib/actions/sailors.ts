/**
 * Server-Actions: Segler-CRUD, Merge und Stammdaten-Import.
 *
 * Was hier lebt:
 * - `createSailor`, `updateSailor`, `deleteSailor` — CRUD aus FormData,
 *   delete blockiert wenn TeamEntries existieren
 * - `previewMergeSailorsAction` — Vorschau eines Helm-Merge: Anzahl
 *   betroffener TeamEntries, neue Alt-Namen, Konflikt-Erkennung wenn
 *   beide Helms in derselben Regatta gestartet sind
 * - `mergeSailorsAction` — primary übernimmt alle Einträge des secondary,
 *   secondary wird gelöscht. Audit-Log + Transaction
 * - `previewStammdatenAction` — Tab-getrenntes Bulk-Update von
 *   Geburtsjahr/Geschlecht. Erkennt Postgres-COPY-Format mit `\N`
 *   (Issue #23). Pure Vorschau, schreibt nichts
 * - `applyStammdatenAction` — User wählt pro Zeile, ob Geburtsjahr und/
 *   oder Geschlecht übernommen werden soll. Schreibt nur die freigegebenen
 *   Werte
 *
 * Schreibt in: `Sailor`, `TeamEntry` (beim Merge), `AuditLog`
 * (`SAILOR_MERGED`).
 *
 * Auth: alle Actions erfordern eine gültige Session.
 *
 * Wichtige Invarianten:
 * - Geburtsjahr/Geschlecht werden nie geraten — bei Update werden leer-
 *   bleibende Felder als Override-mit-null nicht akzeptiert (s.
 *   Schema-Validierung)
 * - Merge-Konflikt: wenn beide Helms in der gleichen Regatta starten,
 *   würde das `@@unique([regattaId, helmId])` verletzen → Merge wird
 *   geblockt mit Liste der konflikten Regatten
 */
"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { sailorSchema } from "@/lib/schemas/sailor";
import { revalidatePath } from "next/cache";
import { parseStammdaten } from "@/lib/import/parse-stammdaten";
import { findMatches } from "@/lib/import/matching";
import { toTitleCase } from "@/lib/import/normalize";
import { logAudit, A } from "@/lib/security/audit";

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

// ── Merge two sailors ─────────────────────────────────────────────────────────
//
// Use case: import or manual entry created two records for the same person
// (e.g. "Hajo Porthun" and "Hans-Joachim Porthun"). Merging:
//   - reassigns all TeamEntries (helmId + crewId) from secondary to primary
//   - moves secondary's name + alternativeNames into primary's alternativeNames
//   - copies optional fields where primary's are null and secondary has a value
//   - deletes the secondary sailor record
// Issue #7

export type MergePreview = {
  primary: { id: string; firstName: string; lastName: string };
  secondary: { id: string; firstName: string; lastName: string };
  helmEntriesCount: number;
  crewEntriesCount: number;
  /** Regatta IDs/names where both sailors are helms — would violate
   *  TeamEntry's @@unique([regattaId, helmId]) constraint. Merge is blocked
   *  until the conflict is resolved manually. */
  conflictingRegattas: { id: string; name: string }[];
  /** Fields that will be copied from secondary → primary. */
  fieldsToFill: { field: string; value: string }[];
  /** Names that will be added to primary's alternativeNames. */
  newAlternativeNames: string[];
};

async function buildMergePreview(
  primaryId: string,
  secondaryId: string
): Promise<{ ok: true; preview: MergePreview } | { ok: false; error: string }> {
  if (primaryId === secondaryId) {
    return { ok: false, error: "Beide Segler sind identisch." };
  }
  const [primary, secondary] = await Promise.all([
    db.sailor.findUnique({ where: { id: primaryId } }),
    db.sailor.findUnique({ where: { id: secondaryId } }),
  ]);
  if (!primary || !secondary) {
    return { ok: false, error: "Ein Segler wurde nicht gefunden." };
  }

  const [helmEntries, crewEntries] = await Promise.all([
    db.teamEntry.findMany({
      where: { helmId: secondaryId },
      include: { regatta: { select: { id: true, name: true } } },
    }),
    db.teamEntry.count({ where: { crewId: secondaryId } }),
  ]);

  // Check for same-regatta helm conflicts
  const primaryHelmRegattas = new Set(
    (await db.teamEntry.findMany({
      where: { helmId: primaryId },
      select: { regattaId: true },
    })).map((e) => e.regattaId)
  );
  const conflictingRegattas = helmEntries
    .filter((e) => primaryHelmRegattas.has(e.regattaId))
    .map((e) => ({ id: e.regatta.id, name: e.regatta.name }));

  // Compute alternativeNames to add
  const existingAlts: string[] = JSON.parse(primary.alternativeNames || "[]");
  const secondaryAlts: string[] = JSON.parse(secondary.alternativeNames || "[]");
  const secondaryFullName = `${secondary.firstName} ${secondary.lastName}`;
  const candidates = [secondaryFullName, ...secondaryAlts];
  const newAlternativeNames = candidates.filter(
    (n) => !existingAlts.includes(n) && n !== `${primary.firstName} ${primary.lastName}`
  );

  // Compute fields to copy (only if primary's is null and secondary has a value)
  const fieldsToFill: { field: string; value: string }[] = [];
  if (primary.birthYear == null && secondary.birthYear != null) {
    fieldsToFill.push({ field: "Geburtsjahr", value: String(secondary.birthYear) });
  }
  if (!primary.gender && secondary.gender) {
    fieldsToFill.push({ field: "Geschlecht", value: secondary.gender });
  }
  if (!primary.club && secondary.club) {
    fieldsToFill.push({ field: "Verein", value: secondary.club });
  }
  if (!primary.sailingLicenseId && secondary.sailingLicenseId) {
    fieldsToFill.push({ field: "Segelnummer", value: secondary.sailingLicenseId });
  }

  return {
    ok: true,
    preview: {
      primary: {
        id: primary.id,
        firstName: primary.firstName,
        lastName: primary.lastName,
      },
      secondary: {
        id: secondary.id,
        firstName: secondary.firstName,
        lastName: secondary.lastName,
      },
      helmEntriesCount: helmEntries.length,
      crewEntriesCount: crewEntries,
      conflictingRegattas,
      fieldsToFill,
      newAlternativeNames,
    },
  };
}

export async function previewMergeSailorsAction(
  primaryId: string,
  secondaryId: string
): Promise<{ ok: true; preview: MergePreview } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  return buildMergePreview(primaryId, secondaryId);
}

export async function mergeSailorsAction(
  primaryId: string,
  secondaryId: string
): Promise<{ ok: true; preview: MergePreview } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const previewResult = await buildMergePreview(primaryId, secondaryId);
  if (!previewResult.ok) return previewResult;
  const preview = previewResult.preview;

  if (preview.conflictingRegattas.length > 0) {
    return {
      ok: false,
      error:
        "Beide Segler sind als Steuermann in derselben Regatta eingetragen: " +
        preview.conflictingRegattas.map((r) => r.name).join(", ") +
        ". Bitte einen der beiden Einträge zuerst manuell bereinigen.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Reassign TeamEntries from secondary → primary
      await tx.teamEntry.updateMany({
        where: { helmId: secondaryId },
        data: { helmId: primaryId },
      });
      await tx.teamEntry.updateMany({
        where: { crewId: secondaryId },
        data: { crewId: primaryId },
      });

      // Build the new primary record
      const updateData: {
        alternativeNames?: string;
        birthYear?: number;
        gender?: string;
        club?: string;
        sailingLicenseId?: string;
      } = {};

      const existingAlts: string[] = JSON.parse(
        (await tx.sailor.findUnique({ where: { id: primaryId } }))?.alternativeNames || "[]"
      );
      const merged = [...existingAlts, ...preview.newAlternativeNames];
      updateData.alternativeNames = JSON.stringify(merged);

      // Fill optional fields where primary was null
      const sec = await tx.sailor.findUnique({ where: { id: secondaryId } });
      if (sec) {
        const prim = await tx.sailor.findUnique({ where: { id: primaryId } });
        if (prim) {
          if (prim.birthYear == null && sec.birthYear != null) updateData.birthYear = sec.birthYear;
          if (!prim.gender && sec.gender) updateData.gender = sec.gender;
          if (!prim.club && sec.club) updateData.club = sec.club;
          if (!prim.sailingLicenseId && sec.sailingLicenseId) updateData.sailingLicenseId = sec.sailingLicenseId;
        }
      }

      await tx.sailor.update({ where: { id: primaryId }, data: updateData });

      // Finally remove the secondary sailor
      await tx.sailor.delete({ where: { id: secondaryId } });
    });

    await logAudit({
      userId: session.user?.id,
      action: A.SAILOR_MERGED,
      detail:
        `${preview.secondary.firstName} ${preview.secondary.lastName} (${secondaryId}) → ` +
        `${preview.primary.firstName} ${preview.primary.lastName} (${primaryId}) · ` +
        `helm:${preview.helmEntriesCount}, crew:${preview.crewEntriesCount}, ` +
        `altNames:+${preview.newAlternativeNames.length}, fields:+${preview.fieldsToFill.length}`,
    });

    revalidatePath("/admin/segler");
    revalidatePath(`/admin/segler/${primaryId}`);
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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
