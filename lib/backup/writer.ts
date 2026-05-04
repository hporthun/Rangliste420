/**
 * Backup writer with two storage backends:
 *
 *  1. **Vercel Blob** (when BLOB_READ_WRITE_TOKEN is present, e.g. on Vercel
 *     with Blob enabled). Files persist across deploys and cold starts.
 *
 *  2. **Filesystem** (default for local dev). Files live under BACKUP_DIR
 *     (./data/backups by default).
 *
 *  The two backends share the same public API (writeBackupFile, listBackups,
 *  deleteBackupFile, getBackupBytes) — callers do not need to know which
 *  backend is active. Selection happens once at module load via the
 *  HAS_BLOB_STORAGE flag.
 */

import fs from "fs";
import path from "path";
import { put, list, del, head } from "@vercel/blob";
import {
  BACKUP_DIR,
  HAS_BLOB_STORAGE,
  ensureBackupDir,
  readSchedule,
} from "./config";
import { encryptBackup, isEncryptedJson } from "./crypto";
import { db } from "@/lib/db/client";

export type StoredBackup = {
  filename: string;
  /** ISO string */
  createdAt: string;
  /** bytes */
  size: number;
  isEncrypted: boolean;
  /** Optional note set when the backup was created */
  comment?: string;
  /** Direct download URL (Vercel Blob) — undefined for FS-backed backups */
  url?: string;
};

const FILENAME_RE = /^420ranking-backup-[\d\-T]+\.json$/;
/** Top-level prefix used for both blob keys and on-disk filenames. */
const BLOB_PREFIX = "backups/";

function metaName(filename: string) {
  return filename.replace(/\.json$/, ".meta.json");
}

// ── Snapshot & filename helpers ────────────────────────────────────────────────

async function buildSnapshot() {
  const [
    sailors,
    regattas,
    rankings,
    teamEntries,
    results,
    rankingRegattas,
    importSessions,
    users,
    webAuthnCredentials,
    mailConfigs,
    auditLog,
    pushSubscriptions,
  ] = await Promise.all([
    db.sailor.findMany({ orderBy: { id: "asc" } }),
    db.regatta.findMany({ orderBy: { id: "asc" } }),
    db.ranking.findMany({ orderBy: { id: "asc" } }),
    db.teamEntry.findMany({ orderBy: { id: "asc" } }),
    db.result.findMany({ orderBy: { id: "asc" } }),
    db.rankingRegatta.findMany({ orderBy: [{ rankingId: "asc" }, { regattaId: "asc" }] }),
    db.importSession.findMany({ orderBy: { id: "asc" } }),
    db.user.findMany({ orderBy: { id: "asc" } }),
    db.webAuthnCredential.findMany({ orderBy: { id: "asc" } }),
    db.mailConfig.findMany({ orderBy: { id: "asc" } }),
    db.auditLog.findMany({ orderBy: { id: "asc" } }),
    db.pushSubscription.findMany({ orderBy: { id: "asc" } }),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: {
      sailors: sailors.length,
      regattas: regattas.length,
      rankings: rankings.length,
      teamEntries: teamEntries.length,
      results: results.length,
      rankingRegattas: rankingRegattas.length,
      importSessions: importSessions.length,
      users: users.length,
      webAuthnCredentials: webAuthnCredentials.length,
      mailConfigs: mailConfigs.length,
      auditLog: auditLog.length,
      pushSubscriptions: pushSubscriptions.length,
    },
    data: {
      sailors,
      regattas,
      rankings,
      teamEntries,
      results,
      rankingRegattas,
      importSessions,
      users,
      webAuthnCredentials,
      mailConfigs,
      auditLog,
      pushSubscriptions,
    },
  };
}

function timestampedFilename(): string {
  const stamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  return `420ranking-backup-${stamp}.json`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Write a full backup, prune old ones, return the filename. */
export async function writeBackupFile(comment?: string): Promise<string> {
  const schedule = await readSchedule();
  const snapshot = await buildSnapshot();
  const plainJson = JSON.stringify(
    snapshot,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
  const content = schedule.encryptionPassword
    ? encryptBackup(plainJson, schedule.encryptionPassword)
    : plainJson;
  const filename = timestampedFilename();

  if (HAS_BLOB_STORAGE) {
    await blobWrite(filename, content, comment);
  } else {
    await fsWrite(filename, content, comment);
  }

  await pruneOldBackups(schedule.maxKeep);
  return filename;
}

/** List stored backups, newest first. */
export async function listBackups(): Promise<StoredBackup[]> {
  return HAS_BLOB_STORAGE ? blobList() : fsList();
}

/** Delete a backup by filename. Returns true on success. */
export async function deleteBackupFile(filename: string): Promise<boolean> {
  if (!FILENAME_RE.test(filename)) return false;
  return HAS_BLOB_STORAGE ? blobDelete(filename) : fsDelete(filename);
}

/**
 * Retrieve raw backup bytes for a given filename — used by the download API
 * route. Returns null if the file doesn't exist.
 */
export async function getBackupBytes(
  filename: string
): Promise<Buffer | null> {
  if (!FILENAME_RE.test(filename)) return null;
  return HAS_BLOB_STORAGE ? blobRead(filename) : fsRead(filename);
}

// ── Filesystem backend ────────────────────────────────────────────────────────

async function fsWrite(filename: string, content: string, comment?: string) {
  ensureBackupDir();
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, content, "utf-8");
  if (comment?.trim()) {
    fs.writeFileSync(
      path.join(BACKUP_DIR, metaName(filename)),
      JSON.stringify({ comment: comment.trim() }, null, 2),
      "utf-8"
    );
  }
}

function fsList(): StoredBackup[] {
  try {
    ensureBackupDir();
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => FILENAME_RE.test(f))
      .map((filename) => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stat = fs.statSync(filepath);
        const head = fs.readFileSync(filepath, { encoding: "utf-8", flag: "r" }).slice(0, 30);
        let comment: string | undefined;
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(BACKUP_DIR, metaName(filename)), "utf-8")
          ) as { comment?: string };
          comment = meta.comment?.trim() || undefined;
        } catch { /* no meta file */ }
        return {
          filename,
          createdAt: stat.mtime.toISOString(),
          size: stat.size,
          isEncrypted: isEncryptedJson(head),
          comment,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function fsDelete(filename: string): boolean {
  const filepath = path.join(BACKUP_DIR, filename);
  // Defence-in-depth: ensure path stays inside BACKUP_DIR
  const safeDir = path.normalize(BACKUP_DIR) + path.sep;
  if (!path.normalize(filepath).startsWith(safeDir)) return false;
  try {
    fs.unlinkSync(filepath);
    try { fs.unlinkSync(path.join(BACKUP_DIR, metaName(filename))); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

function fsRead(filename: string): Buffer | null {
  const filepath = path.join(BACKUP_DIR, filename);
  const safeDir = path.normalize(BACKUP_DIR) + path.sep;
  if (!path.normalize(filepath).startsWith(safeDir)) return null;
  try {
    return fs.readFileSync(filepath);
  } catch {
    return null;
  }
}

// ── Vercel Blob backend ───────────────────────────────────────────────────────

async function blobWrite(filename: string, content: string, comment?: string) {
  // addRandomSuffix:false keeps the filename predictable so list/get work
  await put(BLOB_PREFIX + filename, content, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  if (comment?.trim()) {
    await put(
      BLOB_PREFIX + metaName(filename),
      JSON.stringify({ comment: comment.trim() }, null, 2),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );
  }
}

async function blobList(): Promise<StoredBackup[]> {
  try {
    const result = await list({ prefix: BLOB_PREFIX });
    // result.blobs has { url, pathname, size, uploadedAt, ... }
    const backups = result.blobs.filter((b) =>
      FILENAME_RE.test(b.pathname.replace(BLOB_PREFIX, ""))
    );
    const metas = new Map<string, string>();
    for (const m of result.blobs.filter((b) =>
      b.pathname.endsWith(".meta.json") && !FILENAME_RE.test(b.pathname.replace(BLOB_PREFIX, ""))
    )) {
      // Fetch comment text — small files, parallelism not critical
      try {
        const r = await fetch(m.url);
        if (r.ok) {
          const meta = (await r.json()) as { comment?: string };
          if (meta.comment?.trim()) {
            const baseFilename = m.pathname
              .replace(BLOB_PREFIX, "")
              .replace(/\.meta\.json$/, ".json");
            metas.set(baseFilename, meta.comment.trim());
          }
        }
      } catch { /* ignore individual meta failures */ }
    }
    const out: StoredBackup[] = [];
    for (const b of backups) {
      const filename = b.pathname.replace(BLOB_PREFIX, "");
      // Detect encryption: fetch first 30 bytes via HTTP Range
      let isEncrypted = false;
      try {
        const r = await fetch(b.url, { headers: { Range: "bytes=0-29" } });
        if (r.ok) {
          const text = await r.text();
          isEncrypted = isEncryptedJson(text);
        }
      } catch { /* default false */ }
      out.push({
        filename,
        // Must be ISO format (YYYY-MM-DD…) so that lexical sort below matches
        // chronological order. Date.prototype.toString() yields "Sat May 04 …"
        // which sorts alphabetically by weekday name and breaks the order.
        createdAt: new Date(b.uploadedAt).toISOString(),
        size: b.size,
        isEncrypted,
        comment: metas.get(filename),
        url: b.url,
      });
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    console.warn("[backup-writer] blobList failed:", e);
    return [];
  }
}

async function blobDelete(filename: string): Promise<boolean> {
  try {
    // We need the URL — list to find it
    const result = await list({ prefix: BLOB_PREFIX + filename });
    const target = result.blobs.find((b) => b.pathname === BLOB_PREFIX + filename);
    if (!target) return false;
    await del(target.url);
    // Try to delete sidecar meta — best-effort
    const metaResult = await list({ prefix: BLOB_PREFIX + metaName(filename) });
    const metaBlob = metaResult.blobs.find(
      (b) => b.pathname === BLOB_PREFIX + metaName(filename)
    );
    if (metaBlob) await del(metaBlob.url);
    return true;
  } catch (e) {
    console.warn("[backup-writer] blobDelete failed:", e);
    return false;
  }
}

async function blobRead(filename: string): Promise<Buffer | null> {
  try {
    const meta = await head(BLOB_PREFIX + filename);
    const r = await fetch(meta.url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ── Pruning ───────────────────────────────────────────────────────────────────

async function pruneOldBackups(maxKeep: number) {
  const backups = await listBackups();
  if (backups.length > maxKeep) {
    for (const old of backups.slice(maxKeep)) {
      await deleteBackupFile(old.filename);
    }
  }
}
