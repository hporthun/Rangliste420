/**
 * Server-Actions: TeamEntry-Verwaltung.
 *
 * - `setCrewSwapAction`       — Schottenwechsel-Toggle (Issue #11)
 * - `updateTeamEntryAction`   — Segelnummer, Startgebiet-Flag, Rennwertungen (Issue #39)
 * - `deleteTeamEntryAction`   — Eintrag inkl. Result löschen (Issue #39)
 * - `addTeamEntryAction`      — Neuen Eintrag manuell anlegen (Issue #41)
 *
 * Auth: alle Actions erfordern eine gültige Session.
 */
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

type Result = { ok: true } | { ok: false; error: string };

const swapSchema = z.object({
  teamEntryId: z.string().min(1),
  approved: z.boolean(),
  note: z.string().max(500).default(""),
});

/**
 * Setzt den Schottenwechsel-Status für einen TeamEntry.
 *
 * Issue #11: Pro Regatta-Eintrag (TeamEntry) lässt sich kennzeichnen, ob
 * für die Crew ein vom Veranstalter genehmigter Schottenwechsel vorlag.
 * Der Schalter ist relevant für die IDJM-Quali-Berechnung und für die
 * öffentliche Transparenz auf den Detail-Seiten.
 */
export async function setCrewSwapAction(
  input: z.infer<typeof swapSchema>
): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const { teamEntryId, approved, note } = parsed.data;

  const entry = await db.teamEntry.findUnique({
    where: { id: teamEntryId },
    select: { regattaId: true },
  });
  if (!entry) return { ok: false, error: "Eintrag nicht gefunden." };

  await db.teamEntry.update({
    where: { id: teamEntryId },
    data: {
      crewSwapApproved: approved,
      // Note nur überschreiben, wenn der Caller einen schickt — leere
      // Strings behalten wir aber bei (User wollte vielleicht löschen).
      crewSwapNote: note,
    },
  });

  revalidatePath(`/admin/regatten/${entry.regattaId}`);
  return { ok: true };
}

// ── Issue #39: manuelle Nachbearbeitung ───────────────────────────────────────

const raceScoreSchema = z.object({
  race: z.number().int().min(1),
  points: z.number().min(0),
  code: z.string().max(10).nullable().optional(),
  isDiscard: z.boolean(),
});

const updateTeamEntrySchema = z.object({
  teamEntryId: z.string().min(1),
  sailNumber: z.string().max(30).nullable(),
  inStartArea: z.boolean(),
  raceScores: z.array(raceScoreSchema),
  /** Explizit gesetzter Rang. null = automatisch neu berechnen. */
  manualRank: z.number().int().min(1).nullable().optional(),
});

/**
 * Aktualisiert Segelnummer, Startgebiet-Flag und Rennwertungen eines
 * TeamEntry. Berechnet finalPoints neu und vergibt allen Einträgen der
 * Regatta neue Platzierungen (aufsteigend nach finalPoints).
 *
 * Issue #39.
 */
export async function updateTeamEntryAction(
  input: z.infer<typeof updateTeamEntrySchema>
): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = updateTeamEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const { teamEntryId, sailNumber, inStartArea, raceScores, manualRank } = parsed.data;

  const entry = await db.teamEntry.findUnique({
    where: { id: teamEntryId },
    select: { regattaId: true, result: { select: { id: true } } },
  });
  if (!entry) return { ok: false, error: "Eintrag nicht gefunden." };
  const { regattaId } = entry;

  // finalPoints = Summe aller nicht gestrichenen Wertungen
  const finalPoints = raceScores
    .filter((s) => !s.isDiscard)
    .reduce((sum, s) => sum + s.points, 0);

  await db.$transaction([
    db.teamEntry.update({
      where: { id: teamEntryId },
      data: { sailNumber: sailNumber ?? null },
    }),
    ...(entry.result
      ? [
          db.result.update({
            where: { id: entry.result.id },
            data: {
              racePoints: JSON.stringify(raceScores),
              finalPoints,
              inStartArea,
              // Rang nur explizit setzen wenn übergeben; bei null → Neuberechnung unten
              ...(manualRank != null ? { finalRank: manualRank } : {}),
            },
          }),
        ]
      : []),
  ]);

  // Auto-Reranking nur wenn kein manueller Rang gesetzt wurde
  if (manualRank == null) {
    await rerankRegatta(regattaId);
  }

  revalidatePath(`/admin/regatten/${regattaId}`);
  return { ok: true };
}

/**
 * Löscht einen TeamEntry (cascade → Result).
 *
 * Issue #39.
 */
export async function deleteTeamEntryAction(teamEntryId: string): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  if (!teamEntryId) return { ok: false, error: "Keine ID angegeben." };

  const entry = await db.teamEntry.findUnique({
    where: { id: teamEntryId },
    select: { regattaId: true },
  });
  if (!entry) return { ok: false, error: "Eintrag nicht gefunden." };
  const { regattaId } = entry;

  await db.teamEntry.delete({ where: { id: teamEntryId } });
  await rerankRegatta(regattaId);

  revalidatePath(`/admin/regatten/${regattaId}`);
  return { ok: true };
}

// ── Issue #41: manuellen Eintrag hinzufügen ──────────────────────────────────

const addTeamEntrySchema = z.object({
  regattaId: z.string().min(1),
  helmId: z.string().min(1),
  crewId: z.string().min(1).nullable(),
  sailNumber: z.string().max(30).nullable(),
  inStartArea: z.boolean(),
  raceScores: z.array(raceScoreSchema),
});

/**
 * Legt manuell einen neuen TeamEntry mit Result für eine Regatta an und
 * vergibt alle Platzierungen neu.
 *
 * Issue #41.
 */
export async function addTeamEntryAction(
  input: z.infer<typeof addTeamEntrySchema>
): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = addTeamEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const { regattaId, helmId, crewId, sailNumber, inStartArea, raceScores } = parsed.data;

  const existing = await db.teamEntry.findFirst({
    where: { regattaId, helmId },
  });
  if (existing) {
    return { ok: false, error: "Dieser Steuermann ist in der Regatta bereits eingetragen." };
  }

  const finalPoints = raceScores
    .filter((s) => !s.isDiscard)
    .reduce((sum, s) => sum + s.points, 0);

  const entry = await db.teamEntry.create({
    data: {
      regattaId,
      helmId,
      crewId: crewId ?? null,
      sailNumber: sailNumber ?? null,
    },
  });

  await db.result.create({
    data: {
      regattaId,
      teamEntryId: entry.id,
      racePoints: JSON.stringify(raceScores),
      finalPoints,
      inStartArea,
    },
  });

  await rerankRegatta(regattaId);

  revalidatePath(`/admin/regatten/${regattaId}`);
  return { ok: true };
}

// Vergibt allen Results einer Regatta neue Platzierungen nach finalPoints asc.
// Gleichstand → gleicher Rang, nächster Rang überspringt entsprechend.
async function rerankRegatta(regattaId: string) {
  const results = await db.result.findMany({
    where: { regattaId },
    select: { id: true, finalPoints: true },
  });

  const ranked = results
    .filter((r) => r.finalPoints !== null)
    .sort((a, b) => Number(a.finalPoints) - Number(b.finalPoints));

  let rank = 1;
  await Promise.all(
    ranked.map((r, i) => {
      if (i > 0 && Number(ranked[i].finalPoints) !== Number(ranked[i - 1].finalPoints)) {
        rank = i + 1;
      }
      return db.result.update({ where: { id: r.id }, data: { finalRank: rank } });
    })
  );
}
