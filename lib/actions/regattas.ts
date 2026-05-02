/**
 * Server-Actions: Regatta-CRUD + M2S-Bulk-Import.
 *
 * Was hier lebt:
 * - `createRegatta`        — neue Regatta aus FormData
 * - `updateRegatta`        — bestehende Regatta editieren (Faktor,
 *                             totalStarters, completedRaces, …)
 * - `deleteRegatta`        — Regatta + zugehörige TeamEntries / Results
 *                             löschen (ON DELETE CASCADE)
 * - `importRegattenAction` — Bulk-Import von Regatta-Stammdaten aus
 *                             einer M2S-Class-Association-Liste oder
 *                             Paste (kein Ergebnis-Import — nur die
 *                             Metadaten der Regatten)
 * - `fetchM2SCalendarAction` / `checkM2SUrlAction` — Hilfen für die
 *                             Regatta-Liste-Import-UI
 *
 * Validierung: alle Form-Inputs gehen durch `regattaSchema` (Zod).
 *
 * Schreibt in: `Regatta`-Tabelle.
 *
 * Auth: alle Actions erfordern eine gültige Session.
 */
"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { regattaSchema } from "@/lib/schemas/regatta";
import { revalidatePath } from "next/cache";
import type { ParsedRegattaRow } from "@/lib/import/parse-regatta-list";
import {
  fetchClassAssociationRegattas,
  type M2SRegattaCandidate,
} from "@/lib/import/manage2sail-api";
import { broadcastPush } from "@/lib/push/notify";

function parseInput(data: FormData) {
  const raw = Object.fromEntries(data.entries());
  return regattaSchema.safeParse({
    ...raw,
    multiDayAnnouncement: raw.multiDayAnnouncement === "on",
    isRanglistenRegatta: raw.isRanglistenRegatta === "on",
    plannedRaces: raw.plannedRaces === "" ? null : raw.plannedRaces,
    totalStarters: raw.totalStarters === "" ? null : raw.totalStarters,
    location: raw.location || null,
    sourceUrl: raw.sourceUrl || null,
    notes: raw.notes || null,
  });
}

export async function createRegatta(data: FormData) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  const parsed = parseInput(data);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };

  const { startDate, endDate, ...rest } = parsed.data;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const numDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const regatta = await db.regatta.create({
    data: { ...rest, startDate: start, endDate: end, numDays },
  });

  revalidatePath("/admin/regatten");

  if (regatta.isRanglistenRegatta) {
    await broadcastPush({
      title: "Neue Regatta",
      body: regatta.name,
      url: `/regatta/${regatta.id}`,
      count: 1,
      tag: `regatta:${regatta.id}`,
    });
  }

  return { ok: true as const, data: regatta };
}

export async function updateRegatta(id: string, data: FormData) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  const parsed = parseInput(data);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };

  const { startDate, endDate, ...rest } = parsed.data;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const numDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const regatta = await db.regatta.update({
    where: { id },
    data: { ...rest, startDate: start, endDate: end, numDays },
  });

  revalidatePath("/admin/regatten");
  revalidatePath(`/admin/regatten/${id}`);
  return { ok: true as const, data: regatta };
}

// ── Bulk import from regatta list ─────────────────────────────────────────────

export type ImportRegattaRow = ParsedRegattaRow & {
  /** true = save as Ranglistenregatta */
  isRanglistenRegatta: boolean;
  /** Manage2Sail event URL (optional) */
  sourceUrl?: string;
};

export async function importRegattenAction(
  rows: ImportRegattaRow[]
): Promise<
  | { ok: true; created: number; skipped: number; urlUpdated: number }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    let created = 0;
    let skipped = 0;
    let urlUpdated = 0;
    let createdRanglistenregattas = 0;

    for (const row of rows) {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);

      // Existing regatta? Match by name + startDate.
      const exists = await db.regatta.findFirst({
        where: { name: row.name, startDate: start },
        select: { id: true, sourceUrl: true },
      });
      if (exists) {
        // Wenn M2S eine sourceUrl liefert, die bei uns fehlt oder abweicht,
        // ergänzen / aktualisieren wir sie still. Andere Felder bleiben
        // unangetastet — sie könnten manuell gepflegt sein.
        if (row.sourceUrl && row.sourceUrl !== exists.sourceUrl) {
          await db.regatta.update({
            where: { id: exists.id },
            data: { sourceUrl: row.sourceUrl, sourceType: "MANAGE2SAIL_PASTE" },
          });
          urlUpdated++;
        } else {
          skipped++;
        }
        continue;
      }

      await db.regatta.create({
        data: {
          name: row.name,
          startDate: start,
          endDate: end,
          numDays: row.numDays,
          country: row.country,
          ranglistenFaktor: row.ranglistenFaktor,
          completedRaces: row.completedRaces,
          multiDayAnnouncement: row.multiDayAnnouncement,
          isRanglistenRegatta: row.isRanglistenRegatta,
          sourceType: row.sourceUrl ? "MANAGE2SAIL_PASTE" : "MANUAL",
          sourceUrl: row.sourceUrl || null,
        },
      });
      created++;
      if (row.isRanglistenRegatta) createdRanglistenregattas++;
    }

    revalidatePath("/admin/regatten");

    // Sammelt mehrere Importe in einer einzigen Push-Nachricht — sonst
    // bekäme der Nutzer beim Bulk-Import 30 Pings auf einmal.
    if (createdRanglistenregattas > 0) {
      await broadcastPush({
        title:
          createdRanglistenregattas === 1
            ? "Neue Regatta"
            : `${createdRanglistenregattas} neue Regatten`,
        body: "Im Regattakalender ergänzt.",
        url: "/regatten",
        count: 1,
        tag: "regatta:bulk",
      });
    }

    return { ok: true, created, skipped, urlUpdated };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Manage2Sail regatta list fetch ────────────────────────────────────────────

export async function fetchM2SRegattaListAction(
  year: number
): Promise<{ ok: true; candidates: M2SRegattaCandidate[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const result = await fetchClassAssociationRegattas(year);
    if (!Array.isArray(result)) return { ok: false, error: result.error };
    return { ok: true, candidates: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── M2S race-count comparison ─────────────────────────────────────────────────

export type RaceDiff = {
  m2sRaces: number;
  ourRaces: number;
};

/** Fetch M2S list for `year`, match against our DB by sourceUrl, return per-ID diffs. */
export async function checkM2SRaceCountsAction(
  year: number
): Promise<
  | { ok: true; diffs: Record<string, RaceDiff>; checked: number }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const m2sResult = await fetchClassAssociationRegattas(year);
    if (!Array.isArray(m2sResult)) return { ok: false, error: m2sResult.error };

    const ourRegattas = await db.regatta.findMany({
      where: {
        startDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
        sourceUrl: { not: null },
      },
      select: { id: true, completedRaces: true, sourceUrl: true },
    });

    function norm(url: string) {
      return url.split("#")[0].replace(/\/$/, "").toLowerCase();
    }

    const diffs: Record<string, RaceDiff> = {};
    for (const our of ourRegattas) {
      if (!our.sourceUrl) continue;
      const m2s = m2sResult.find(
        (m) => m.sourceUrl && norm(m.sourceUrl) === norm(our.sourceUrl!)
      );
      if (!m2s) continue;
      if (m2s.m2sRaces !== our.completedRaces) {
        diffs[our.id] = { m2sRaces: m2s.m2sRaces, ourRaces: our.completedRaces };
      }
    }

    return { ok: true, diffs, checked: ourRegattas.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteRegatta(id: string) {
  const session = await auth();
  if (!session) return { ok: false as const, error: "Nicht angemeldet." };
  try {
    await db.$transaction([
      // RankingRegatta and ImportSession have no cascade → delete manually first
      db.rankingRegatta.deleteMany({ where: { regattaId: id } }),
      db.importSession.deleteMany({ where: { regattaId: id } }),
      // Deleting the Regatta cascades to TeamEntry and Result (onDelete: Cascade)
      db.regatta.delete({ where: { id } }),
    ]);
    revalidatePath("/admin/regatten");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
}
