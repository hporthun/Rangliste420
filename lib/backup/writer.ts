import fs from "fs";
import path from "path";
import { BACKUP_DIR, ensureBackupDir, readSchedule } from "./config";
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
};

/** Write a full backup to disk, prune old files, return the filename. */
export async function writeBackupFile(comment?: string): Promise<string> {
  ensureBackupDir();

  const schedule = readSchedule();

  const [sailors, regattas, rankings, teamEntries, results, rankingRegattas, importSessions] =
    await Promise.all([
      db.sailor.findMany({ orderBy: { id: "asc" } }),
      db.regatta.findMany({ orderBy: { id: "asc" } }),
      db.ranking.findMany({ orderBy: { id: "asc" } }),
      db.teamEntry.findMany({ orderBy: { id: "asc" } }),
      db.result.findMany({ orderBy: { id: "asc" } }),
      db.rankingRegatta.findMany({ orderBy: [{ rankingId: "asc" }, { regattaId: "asc" }] }),
      db.importSession.findMany({ orderBy: { id: "asc" } }),
    ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      sailors: sailors.length,
      regattas: regattas.length,
      rankings: rankings.length,
      teamEntries: teamEntries.length,
      results: results.length,
      rankingRegattas: rankingRegattas.length,
      importSessions: importSessions.length,
    },
    data: { sailors, regattas, rankings, teamEntries, results, rankingRegattas, importSessions },
  };

  const plainJson = JSON.stringify(backup, null, 2);
  const content =
    schedule.encryptionPassword
      ? encryptBackup(plainJson, schedule.encryptionPassword)
      : plainJson;

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  const filename = `420ranking-backup-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, content, "utf-8");

  // Write sidecar meta file (comment, etc.) — readable without decrypting the backup
  if (comment?.trim()) {
    const metaPath = path.join(BACKUP_DIR, filename.replace(/\.json$/, ".meta.json"));
    fs.writeFileSync(metaPath, JSON.stringify({ comment: comment.trim() }, null, 2), "utf-8");
  }

  // Prune oldest backups according to saved schedule setting
  pruneOldBackups(schedule.maxKeep);

  return filename;
}

/** List stored backups, newest first. */
export function listBackups(): StoredBackup[] {
  try {
    ensureBackupDir();
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("420ranking-backup-") && f.endsWith(".json"))
      .map((filename) => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stat = fs.statSync(filepath);
        // Peek at the first 30 chars to detect encryption without parsing the whole file
        const head = fs.readFileSync(filepath, { encoding: "utf-8", flag: "r" }).slice(0, 30);
        // Read optional sidecar meta file for comment
        let comment: string | undefined;
        try {
          const metaPath = path.join(BACKUP_DIR, filename.replace(/\.json$/, ".meta.json"));
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { comment?: string };
          comment = meta.comment?.trim() || undefined;
        } catch { /* no meta file — fine */ }
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

/** Delete a backup file by filename (validates it's in BACKUP_DIR). */
export function deleteBackupFile(filename: string): boolean {
  // Security: only allow our own backup filenames
  if (!filename.match(/^420ranking-backup-[\d\-T]+\.json$/)) return false;
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filepath.startsWith(BACKUP_DIR)) return false;
  try {
    fs.unlinkSync(filepath);
    // Remove sidecar meta file if present
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, filename.replace(/\.json$/, ".meta.json")));
    } catch { /* no meta file — ignore */ }
    return true;
  } catch {
    return false;
  }
}

function pruneOldBackups(maxKeep: number) {
  const backups = listBackups();
  if (backups.length > maxKeep) {
    for (const old of backups.slice(maxKeep)) {
      deleteBackupFile(old.filename);
    }
  }
}
