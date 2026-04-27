"use server";

import fs from "fs";
import path from "path";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import { logAudit, A } from "@/lib/security/audit";
import { BACKUP_DIR } from "@/lib/backup/config";

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

  // ── Atomic restore: Phase 1 (delete) + Phase 2 (insert) in one transaction ──
  // If the insert phase fails, the deletes are rolled back automatically —
  // no data loss on partial failures.
  //
  // $executeRawUnsafe bypasses Prisma's query-builder so "Maximum array
  // nesting exceeded" cannot be triggered here.
  // SQLite column types: String→TEXT, Int→INTEGER, Boolean→INTEGER (0/1),
  //   Decimal→TEXT, DateTime→INTEGER (Unix ms), Float→REAL
  let restored: Record<string, number>;
  try {
    restored = await db.$transaction(async (tx) => {
      // Phase 1: delete existing data (dependency order)
      try {
        await tx.importSession.deleteMany();
        await tx.rankingRegatta.deleteMany();
        await tx.result.deleteMany();
        await tx.teamEntry.deleteMany();
        await tx.regatta.deleteMany();
        await tx.ranking.deleteMany();
        await tx.sailor.deleteMany();
      } catch (e) {
        throw new Error(`[delete] ${String(e)}`);
      }

      // Phase 2: re-insert via raw SQL
      try {
        for (const s of sailors) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Sailor" ("id","firstName","lastName","birthYear","gender","nationality","club","sailingLicenseId","alternativeNames","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            s.id as string,
            s.firstName as string,
            s.lastName as string,
            s.birthYear != null ? Number(s.birthYear) : null,
            s.gender != null ? String(s.gender) : null,
            (s.nationality as string) ?? "GER",
            s.club != null ? String(s.club) : null,
            s.sailingLicenseId != null ? String(s.sailingLicenseId) : null,
            toJsonStr(s.alternativeNames),
            toIso(s.createdAt),
            toIso(s.updatedAt),
          );
        }
      } catch (e) {
        throw new Error(`[sailors] ${String(e)}`);
      }

      try {
        for (const r of regattas) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Regatta" ("id","name","location","country","startDate","endDate","numDays","plannedRaces","completedRaces","multiDayAnnouncement","ranglistenFaktor","scoringSystem","isRanglistenRegatta","sourceType","sourceUrl","sourceFile","importedAt","notes","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            r.id as string,
            r.name as string,
            r.location != null ? String(r.location) : null,
            (r.country as string) ?? "GER",
            toIso(r.startDate),
            toIso(r.endDate),
            Number(r.numDays ?? 1),
            r.plannedRaces != null ? Number(r.plannedRaces) : null,
            Number(r.completedRaces ?? 0),
            toInt(r.multiDayAnnouncement),
            toDecimalStr(r.ranglistenFaktor),
            (r.scoringSystem as string) ?? "LOW_POINT",
            toInt(r.isRanglistenRegatta),
            (r.sourceType as string) ?? "MANUAL",
            r.sourceUrl != null ? String(r.sourceUrl) : null,
            r.sourceFile != null ? String(r.sourceFile) : null,
            toIsoOrNull(r.importedAt),
            r.notes != null ? String(r.notes) : null,
            toIso(r.createdAt),
            toIso(r.updatedAt),
          );
        }
      } catch (e) {
        throw new Error(`[regattas] ${String(e)}`);
      }

      try {
        for (const r of rankings) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Ranking" ("id","name","type","seasonStart","seasonEnd","ageCategory","genderCategory","scoringRule","isPublic","publishedAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            r.id as string,
            r.name as string,
            r.type as string,
            toIso(r.seasonStart),
            toIso(r.seasonEnd),
            r.ageCategory as string,
            r.genderCategory as string,
            toJsonStr(r.scoringRule, "{}"),
            toInt(r.isPublic),
            toIsoOrNull(r.publishedAt),
            toIso(r.createdAt),
            toIso(r.updatedAt),
          );
        }
      } catch (e) {
        throw new Error(`[rankings] ${String(e)}`);
      }

      try {
        for (const t of teamEntries) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "TeamEntry" ("id","regattaId","helmId","crewId","sailNumber","crewSwapApproved","crewSwapNote","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?)`,
            t.id as string,
            t.regattaId as string,
            t.helmId as string,
            t.crewId != null ? String(t.crewId) : null,
            t.sailNumber != null ? String(t.sailNumber) : null,
            toInt(t.crewSwapApproved),
            t.crewSwapNote != null ? String(t.crewSwapNote) : null,
            toIso(t.createdAt),
            toIso(t.updatedAt),
          );
        }
      } catch (e) {
        throw new Error(`[teamEntries] ${String(e)}`);
      }

      try {
        for (const r of results) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Result" ("id","regattaId","teamEntryId","finalRank","finalPoints","racePoints","inStartArea","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?)`,
            r.id as string,
            r.regattaId as string,
            r.teamEntryId as string,
            r.finalRank != null ? Number(r.finalRank) : null,
            r.finalPoints != null ? toDecimalStr(r.finalPoints) : null,
            toJsonStr(r.racePoints),
            toInt(r.inStartArea),
            toIso(r.createdAt),
            toIso(r.updatedAt),
          );
        }
      } catch (e) {
        throw new Error(`[results] ${String(e)}`);
      }

      try {
        for (const rr of rankingRegattas) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "RankingRegatta" ("rankingId","regattaId","weight") VALUES (?,?,?)`,
            rr.rankingId as string,
            rr.regattaId as string,
            rr.weight != null ? Number(rr.weight) : null,
          );
        }
      } catch (e) {
        throw new Error(`[rankingRegattas] ${String(e)}`);
      }

      try {
        for (const i of importSessions) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "ImportSession" ("id","regattaId","createdBy","parserType","sourceFile","matchDecisions","createdAt") VALUES (?,?,?,?,?,?,?)`,
            i.id as string,
            i.regattaId as string,
            i.createdBy as string,
            i.parserType as string,
            i.sourceFile != null ? String(i.sourceFile) : null,
            toJsonStr(i.matchDecisions, "{}"),
            toIso(i.createdAt),
          );
        }
      } catch (e) {
        throw new Error(`[importSessions] ${String(e)}`);
      }

      return {
        sailors:         sailors.length,
        regattas:        regattas.length,
        rankings:        rankings.length,
        teamEntries:     teamEntries.length,
        results:         results.length,
        rankingRegattas: rankingRegattas.length,
        importSessions:  importSessions.length,
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

    return await _performRestore(rawText, password, session.user?.id);
  } catch (e) {
    console.error("[restore:unknown]", e);
    return { ok: false, error: String(e) };
  }
}

// ── Restore from stored server backup ────────────────────────────────────────

export async function restoreStoredBackupAction(
  filename: string,
  password?: string,
): Promise<{ ok: true; restored: Record<string, number> } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    // Security: only allow our own backup filenames (same regex as deleteBackupFile)
    if (!filename.match(/^420ranking-backup-[\d\-T]+\.json$/)) {
      return { ok: false, error: "Ungültiger Dateiname." };
    }
    const filepath = path.join(BACKUP_DIR, filename);
    // Prevent path traversal (path.normalize + sep avoids prefix-collision on Windows,
    // e.g. C:\backup matching C:\backups)
    const safeDir = path.normalize(BACKUP_DIR) + path.sep;
    if (!path.normalize(filepath).startsWith(safeDir)) {
      return { ok: false, error: "Ungültiger Dateiname." };
    }

    let rawText: string;
    try {
      rawText = fs.readFileSync(filepath, "utf-8");
    } catch {
      return { ok: false, error: "Datei nicht gefunden." };
    }

    return await _performRestore(rawText, password ?? null, session.user?.id);
  } catch (e) {
    console.error("[restore:unknown]", e);
    return { ok: false, error: String(e) };
  }
}
