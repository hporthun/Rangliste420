"use server";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import { logAudit, A } from "@/lib/security/audit";
import { writeBackupFile, getBackupBytes } from "@/lib/backup/writer";

// ── Restore scope ─────────────────────────────────────────────────────────────
/** Which tables to wipe and restore from the backup file. */
export type RestoreScope = "all" | "sailors" | "regattas";

// ── Delete all data (keep Users) ──────────────────────────────────────────────

export async function deleteAllDataAction(): Promise<
  { ok: true; deleted: Record<string, number> } | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    // Delete in dependency order (non-cascading relations first)
    const [
      importSessions,
      rankingRegattas,
      results,
      teamEntries,
      regattas,
      rankings,
      sailors,
    ] = await db.$transaction([
      db.importSession.deleteMany(),
      db.rankingRegatta.deleteMany(),
      db.result.deleteMany(),
      db.teamEntry.deleteMany(),
      db.regatta.deleteMany(),
      db.ranking.deleteMany(),
      db.sailor.deleteMany(),
    ]);

    revalidatePath("/admin");

    const deleted = {
      importSessions: importSessions.count,
      rankingRegattas: rankingRegattas.count,
      results: results.count,
      teamEntries: teamEntries.count,
      regattas: regattas.count,
      rankings: rankings.count,
      sailors: sailors.count,
    };

    await logAudit({
      userId: session.user?.id,
      action: A.DATA_DELETE_ALL,
      detail: Object.entries(deleted).map(([k, v]) => `${k}:${v}`).join(", "),
    });

    return { ok: true, deleted };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Prune old data ────────────────────────────────────────────────────────────

export type PruneResult = {
  regattas: number;
  importSessions: number;
  rankingRegattas: number;
  orphanedSailors: number;
};

/**
 * Deletes all regattas whose startDate is before Jan 1 of `beforeYear`
 * (cascading to TeamEntry + Result), plus all sailors who have no
 * TeamEntry at all afterwards.
 */
export async function pruneOldDataAction(
  beforeYear: number
): Promise<{ ok: true; deleted: PruneResult } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    if (!Number.isInteger(beforeYear) || beforeYear < 2000 || beforeYear > 2100) {
      return { ok: false, error: "Ungültiges Jahr." };
    }

    const cutoff = new Date(beforeYear, 0, 1); // Jan 1 of beforeYear

    const result = await db.$transaction(async (tx) => {
      // Find regattas to delete
      const oldRegattas = await tx.regatta.findMany({
        where: { startDate: { lt: cutoff } },
        select: { id: true },
      });
      const oldIds = oldRegattas.map((r) => r.id);

      if (oldIds.length === 0) {
        return { regattas: 0, importSessions: 0, rankingRegattas: 0, orphanedSailors: 0 };
      }

      // Delete non-cascading dependents first
      const { count: isCount } = await tx.importSession.deleteMany({
        where: { regattaId: { in: oldIds } },
      });
      const { count: rrCount } = await tx.rankingRegatta.deleteMany({
        where: { regattaId: { in: oldIds } },
      });

      // Delete the regattas (cascades to TeamEntry + Result)
      const { count: regCount } = await tx.regatta.deleteMany({
        where: { id: { in: oldIds } },
      });

      // Delete sailors who no longer have any TeamEntry (neither helm nor crew)
      const { count: sailorCount } = await tx.sailor.deleteMany({
        where: {
          helmEntries: { none: {} },
          crewEntries: { none: {} },
        },
      });

      return {
        regattas: regCount,
        importSessions: isCount,
        rankingRegattas: rrCount,
        orphanedSailors: sailorCount,
      };
    });

    revalidatePath("/admin/regatten");
    revalidatePath("/admin/segler");

    await logAudit({
      userId: session.user?.id,
      action: A.DATA_PRUNE,
      detail: `vor ${beforeYear}: regattas:${result.regattas}, sailors:${result.orphanedSailors}, sessions:${result.importSessions}`,
    });

    return { ok: true, deleted: result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Orphan cleanup actions ────────────────────────────────────────────────────

/** Löscht Segler, die weder als Steuermann noch als Crew in einem TeamEntry eingetragen sind. */
export async function pruneOrphanSailorsAction(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    const { count } = await db.sailor.deleteMany({
      where: {
        helmEntries: { none: {} },
        crewEntries: { none: {} },
      },
    });

    revalidatePath("/admin/segler");

    await logAudit({
      userId: session.user?.id,
      action: A.DATA_PRUNE,
      detail: `orphan-sailors:${count}`,
    });

    return { ok: true, deleted: count };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Löscht TeamEntries ohne Ergebnis-Datensätze (Result). */
export async function pruneOrphanTeamEntriesAction(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    const { count } = await db.teamEntry.deleteMany({
      where: { result: { is: null } },
    });

    revalidatePath("/admin/regatten");

    await logAudit({
      userId: session.user?.id,
      action: A.DATA_PRUNE,
      detail: `orphan-team-entries:${count}`,
    });

    return { ok: true, deleted: count };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Löscht Ranglisten, denen keine Regatta zugeordnet ist. */
export async function pruneEmptyRankingsAction(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    const { count } = await db.ranking.deleteMany({
      where: { rankingRegattas: { none: {} } },
    });

    revalidatePath("/admin/ranglisten");

    await logAudit({
      userId: session.user?.id,
      action: A.DATA_PRUNE,
      detail: `empty-rankings:${count}`,
    });

    return { ok: true, deleted: count };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Backup shape ──────────────────────────────────────────────────────────────

type BackupData = {
  version: number;
  exportedAt: string;
  data: {
    sailors: Record<string, unknown>[];
    regattas: Record<string, unknown>[];
    rankings: Record<string, unknown>[];
    teamEntries: Record<string, unknown>[];
    results: Record<string, unknown>[];
    rankingRegattas: Record<string, unknown>[];
    importSessions: Record<string, unknown>[];
  };
};

// ── Restore helpers ───────────────────────────────────────────────────────────

/** JSON-string fields: always return a plain string, never a parsed array. */
function toJsonStr(v: unknown, fallback = "[]"): string {
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  return JSON.stringify(v);
}

/** Decimal fields: accept string, number, or Decimal.js internal object. */
function toDecimalStr(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "toJSON" in (v as object))
    return String((v as { toJSON: () => unknown }).toJSON());
  return String(v);
}

/**
 * Unix timestamp in milliseconds (INTEGER) for SQLite DateTime columns.
 *
 * Prisma's SQLite adapter stores DateTime values as INTEGER milliseconds
 * (e.g. 1645056000000) and binds Date parameters the same way. Storing
 * dates as TEXT (ISO strings) causes Prisma's parameterised filters like
 * `{ startDate: { gte, lte } }` to silently return 0 rows, because
 * SQLite's type affinity rules make TEXT always "greater than" INTEGER in
 * mixed-type comparisons.
 */
function toIso(v: unknown): number {
  if (!v) return Date.now();
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

/** Nullable ms timestamp for optional DateTime columns. */
function toIsoOrNull(v: unknown): number | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Boolean → SQLite INTEGER 0/1. */
function toInt(v: unknown): number { return v ? 1 : 0; }

/**
 * Date helpers for Prisma typed-queries. Prisma expects a JS Date object for
 * DateTime fields and handles cross-provider serialization (SQLite TEXT,
 * Postgres TIMESTAMP) internally.
 */
function toDate(v: unknown): Date {
  if (!v) return new Date();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}
function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// ── Restore backup ────────────────────────────────────────────────────────────

/**
 * Internal helper — does the actual restore work.
 * Accepts the raw file content (encrypted or plain) plus optional password.
 * No DB calls for auth — the caller must verify the session first.
 */
async function _performRestore(
  rawText: string,
  password: string | null,
  userId: string | undefined,
  scope: RestoreScope = "all",
): Promise<{ ok: true; restored: Record<string, number> } | { ok: false; error: string }> {
  // Decrypt if needed
  let plainText = rawText;
  const { isEncryptedJson, decryptBackup } = await import("@/lib/backup/crypto");
  if (isEncryptedJson(rawText)) {
    if (!password) return { ok: false, error: "Backup ist verschlüsselt. Bitte Passwort eingeben." };
    try {
      plainText = decryptBackup(rawText, password);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  let backup: BackupData;
  try {
    backup = JSON.parse(plainText) as BackupData;
  } catch {
    return { ok: false, error: "Ungültiges JSON-Format." };
  }

  if (!backup.data || !backup.version) {
    return { ok: false, error: "Ungültiges Backup-Format (version/data fehlt)." };
  }

  const { sailors, regattas, rankings, teamEntries, results, rankingRegattas, importSessions } =
    backup.data;

  if (
    !Array.isArray(sailors) ||
    !Array.isArray(regattas) ||
    !Array.isArray(rankings) ||
    !Array.isArray(teamEntries) ||
    !Array.isArray(results) ||
    !Array.isArray(rankingRegattas) ||
    !Array.isArray(importSessions)
  ) {
    return { ok: false, error: "Backup-Daten unvollständig oder fehlerhaft." };
  }

  // ── Pre-restore backup (Issue #3) ─────────────────────────────────────────
  // Always create a safety backup of the current state before wiping data.
  // Non-fatal: a failed backup only produces a warning; the restore proceeds.
  try {
    await writeBackupFile("Backup vor Rücksicherung");
  } catch (e) {
    console.warn("[restore:pre-backup]", e);
  }

  // ── Atomic restore: Phase 1 (delete) + Phase 2 (insert) in one transaction ──
  // If the insert phase fails, the deletes are rolled back automatically —
  // no data loss on partial failures.
  //
  // $executeRawUnsafe bypasses Prisma's query-builder so "Maximum array
  // nesting exceeded" cannot be triggered here.
  // SQLite column types: String→TEXT, Int→INTEGER, Boolean→INTEGER (0/1),
  //   Decimal→TEXT, DateTime→INTEGER (Unix ms), Float→REAL
  //
  // scope="all"     → delete + restore everything
  // scope="sailors" → delete + restore only Sailor table
  // scope="regattas"→ delete + restore Regatta + related tables, keep Sailor & Ranking
  let restored: Record<string, number>;
  try {
    restored = await db.$transaction(async (tx) => {
      // ── Phase 1: delete scope-specific tables ──────────────────────────────
      if (scope === "sailors") {
        // Only Sailor — TeamEntries keep existing FK refs (SQLite bypasses via raw SQL)
        try {
          await tx.sailor.deleteMany();
        } catch (e) { throw new Error(`[delete:sailors] ${String(e)}`); }
      } else if (scope === "regattas") {
        // Regatta-related tables only; keep Sailor and Ranking
        try {
          await tx.importSession.deleteMany();
          await tx.rankingRegatta.deleteMany();
          await tx.result.deleteMany();
          await tx.teamEntry.deleteMany();
          await tx.regatta.deleteMany();
        } catch (e) { throw new Error(`[delete:regattas] ${String(e)}`); }
      } else {
        // scope === "all" — full restore (original behaviour)
        try {
          await tx.importSession.deleteMany();
          await tx.rankingRegatta.deleteMany();
          await tx.result.deleteMany();
          await tx.teamEntry.deleteMany();
          await tx.regatta.deleteMany();
          await tx.ranking.deleteMany();
          await tx.sailor.deleteMany();
        } catch (e) { throw new Error(`[delete] ${String(e)}`); }
      }

      // ── Phase 2: re-insert scope-specific data via Prisma typed creates ────
      // Provider-agnostic — works on SQLite (?-placeholders) AND Postgres
      // ($N-placeholders) without any provider-specific syntax.

      if (scope === "all" || scope === "sailors") {
        try {
          for (const s of sailors) {
            await tx.sailor.create({
              data: {
                id: s.id as string,
                firstName: s.firstName as string,
                lastName: s.lastName as string,
                birthYear: s.birthYear != null ? Number(s.birthYear) : null,
                gender: s.gender != null ? String(s.gender) : null,
                nationality: (s.nationality as string) ?? "GER",
                club: s.club != null ? String(s.club) : null,
                sailingLicenseId: s.sailingLicenseId != null ? String(s.sailingLicenseId) : null,
                alternativeNames: toJsonStr(s.alternativeNames),
                createdAt: toDate(s.createdAt),
                updatedAt: toDate(s.updatedAt),
              },
            });
          }
        } catch (e) { throw new Error(`[sailors] ${String(e)}`); }
      }

      if (scope === "all" || scope === "regattas") {
        try {
          for (const r of regattas) {
            await tx.regatta.create({
              data: {
                id: r.id as string,
                name: r.name as string,
                location: r.location != null ? String(r.location) : null,
                country: (r.country as string) ?? "GER",
                startDate: toDate(r.startDate),
                endDate: toDate(r.endDate),
                numDays: Number(r.numDays ?? 1),
                plannedRaces: r.plannedRaces != null ? Number(r.plannedRaces) : null,
                completedRaces: Number(r.completedRaces ?? 0),
                multiDayAnnouncement: !!r.multiDayAnnouncement,
                ranglistenFaktor: toDecimalStr(r.ranglistenFaktor),
                scoringSystem: (r.scoringSystem as string) ?? "LOW_POINT",
                isRanglistenRegatta: !!r.isRanglistenRegatta,
                sourceType: (r.sourceType as string) ?? "MANUAL",
                sourceUrl: r.sourceUrl != null ? String(r.sourceUrl) : null,
                sourceFile: r.sourceFile != null ? String(r.sourceFile) : null,
                importedAt: toDateOrNull(r.importedAt),
                notes: r.notes != null ? String(r.notes) : null,
                createdAt: toDate(r.createdAt),
                updatedAt: toDate(r.updatedAt),
              },
            });
          }
        } catch (e) { throw new Error(`[regattas] ${String(e)}`); }
      }

      if (scope === "all") {
        try {
          for (const r of rankings) {
            await tx.ranking.create({
              data: {
                id: r.id as string,
                name: r.name as string,
                type: r.type as string,
                seasonStart: toDate(r.seasonStart),
                seasonEnd: toDate(r.seasonEnd),
                ageCategory: r.ageCategory as string,
                genderCategory: r.genderCategory as string,
                scoringRule: toJsonStr(r.scoringRule, "{}"),
                isPublic: !!r.isPublic,
                publishedAt: toDateOrNull(r.publishedAt),
                createdAt: toDate(r.createdAt),
                updatedAt: toDate(r.updatedAt),
              },
            });
          }
        } catch (e) { throw new Error(`[rankings] ${String(e)}`); }
      }

      if (scope === "all" || scope === "regattas") {
        try {
          for (const t of teamEntries) {
            await tx.teamEntry.create({
              data: {
                id: t.id as string,
                regattaId: t.regattaId as string,
                helmId: t.helmId as string,
                crewId: t.crewId != null ? String(t.crewId) : null,
                sailNumber: t.sailNumber != null ? String(t.sailNumber) : null,
                crewSwapApproved: !!t.crewSwapApproved,
                crewSwapNote: t.crewSwapNote != null ? String(t.crewSwapNote) : null,
                createdAt: toDate(t.createdAt),
                updatedAt: toDate(t.updatedAt),
              },
            });
          }
        } catch (e) { throw new Error(`[teamEntries] ${String(e)}`); }

        try {
          for (const r of results) {
            await tx.result.create({
              data: {
                id: r.id as string,
                regattaId: r.regattaId as string,
                teamEntryId: r.teamEntryId as string,
                finalRank: r.finalRank != null ? Number(r.finalRank) : null,
                finalPoints: r.finalPoints != null ? toDecimalStr(r.finalPoints) : null,
                racePoints: toJsonStr(r.racePoints),
                inStartArea: !!r.inStartArea,
                createdAt: toDate(r.createdAt),
                updatedAt: toDate(r.updatedAt),
              },
            });
          }
        } catch (e) { throw new Error(`[results] ${String(e)}`); }

        try {
          for (const rr of rankingRegattas) {
            await tx.rankingRegatta.create({
              data: {
                rankingId: rr.rankingId as string,
                regattaId: rr.regattaId as string,
                weight: rr.weight != null ? Number(rr.weight) : null,
              },
            });
          }
        } catch (e) { throw new Error(`[rankingRegattas] ${String(e)}`); }

        try {
          for (const i of importSessions) {
            await tx.importSession.create({
              data: {
                id: i.id as string,
                regattaId: i.regattaId as string,
                createdBy: i.createdBy as string,
                parserType: i.parserType as string,
                sourceFile: i.sourceFile != null ? String(i.sourceFile) : null,
                matchDecisions: toJsonStr(i.matchDecisions, "{}"),
                createdAt: toDate(i.createdAt),
              },
            });
          }
        } catch (e) { throw new Error(`[importSessions] ${String(e)}`); }
      } // end scope regattas/all (team data)

      // ── Return counts for restored tables ─────────────────────────────────
      return {
        sailors:         (scope === "all" || scope === "sailors")   ? sailors.length         : 0,
        regattas:        (scope === "all" || scope === "regattas")  ? regattas.length        : 0,
        rankings:        scope === "all"                            ? rankings.length        : 0,
        teamEntries:     (scope === "all" || scope === "regattas")  ? teamEntries.length     : 0,
        results:         (scope === "all" || scope === "regattas")  ? results.length         : 0,
        rankingRegattas: (scope === "all" || scope === "regattas")  ? rankingRegattas.length : 0,
        importSessions:  (scope === "all" || scope === "regattas")  ? importSessions.length  : 0,
      };
    }, { timeout: 120_000 });
  } catch (e) {
    console.error("[restore:transaction]", e);
    return { ok: false, error: String(e) };
  }

  revalidatePath("/admin");

  await logAudit({
    userId,
    action: A.BACKUP_RESTORED,
    detail: `exportedAt:${backup.exportedAt}, ${Object.entries(restored).map(([k, v]) => `${k}:${v}`).join(", ")}`,
  });

  return { ok: true, restored };
}

// ── Restore from file upload (FormData) ───────────────────────────────────────

export async function restoreBackupAction(
  formData: FormData,
): Promise<{ ok: true; restored: Record<string, number> } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    const file = formData.get("backup");
    if (!file || !(file instanceof Blob)) {
      return { ok: false, error: "Keine Backup-Datei übermittelt." };
    }
    // Guard against OOM from oversized uploads
    if (file.size > 100_000_000) {
      return { ok: false, error: "Backup-Datei zu groß (max. 100 MB)." };
    }
    const rawText = await file.text();
    const password = formData.get("password") as string | null;
    const scopeRaw = formData.get("scope") as string | null;
    const scope: RestoreScope =
      scopeRaw === "sailors" || scopeRaw === "regattas" ? scopeRaw : "all";

    return await _performRestore(rawText, password, session.user?.id, scope);
  } catch (e) {
    console.error("[restore:unknown]", e);
    return { ok: false, error: String(e) };
  }
}

// ── Restore from stored server backup ────────────────────────────────────────

export async function restoreStoredBackupAction(
  filename: string,
  password?: string,
  scope: RestoreScope = "all",
): Promise<{ ok: true; restored: Record<string, number> } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    // Security: only allow our own backup filenames
    if (!filename.match(/^420ranking-backup-[\d\-T]+\.json$/)) {
      return { ok: false, error: "Ungültiger Dateiname." };
    }

    // Storage-agnostic read (FS or Vercel Blob, depending on env)
    const bytes = await getBackupBytes(filename);
    if (!bytes) {
      return { ok: false, error: "Datei nicht gefunden." };
    }
    const rawText = bytes.toString("utf-8");

    return await _performRestore(rawText, password ?? null, session.user?.id, scope);
  } catch (e) {
    console.error("[restore:unknown]", e);
    return { ok: false, error: String(e) };
  }
}
