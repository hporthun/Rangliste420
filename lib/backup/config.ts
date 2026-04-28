import path from "path";
import fs from "fs";
import { db } from "@/lib/db/client";
import type { BackupSchedule } from "./types";

export type { BackupSchedule };

/** Detect a serverless platform where the filesystem is read-only outside /tmp. */
export const IS_SERVERLESS =
  process.env.VERCEL === "1" || process.env.AWS_EXECUTION_ENV !== undefined;

/** Vercel Blob is enabled when its read/write token is in the environment. */
export const HAS_BLOB_STORAGE = !!process.env.BLOB_READ_WRITE_TOKEN;

// Directory where backup JSON files are stored when blob storage is NOT used.
// Override with env var BACKUP_DIR (absolute or relative to cwd).
function getDefaultBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (IS_SERVERLESS) return "/tmp/420ranking-backups";
  return path.join(process.cwd(), "data", "backups");
}
export const BACKUP_DIR = path.resolve(getDefaultBackupDir());

const DEFAULT_SCHEDULE: BackupSchedule = {
  enabled: false,
  hour: 2,
  minute: 0,
  daysOfWeek: [1], // Monday
  maxKeep: 30,
  encryptionPassword: "",
};

export function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Read the backup schedule from the database (singleton row id=1).
 * Returns DEFAULT_SCHEDULE if the row does not exist yet.
 */
export async function readSchedule(): Promise<BackupSchedule> {
  try {
    const row = await db.backupSchedule.findUnique({ where: { id: 1 } });
    if (!row) return { ...DEFAULT_SCHEDULE };
    return {
      enabled: row.enabled,
      hour: row.hour,
      minute: row.minute,
      daysOfWeek: JSON.parse(row.daysOfWeek) as number[],
      maxKeep: row.maxKeep,
      encryptionPassword: row.encryptionPassword,
    };
  } catch (e) {
    console.warn("[backup-config] readSchedule fallback to defaults:", e);
    return { ...DEFAULT_SCHEDULE };
  }
}

/** Upsert the singleton backup schedule row. */
export async function writeSchedule(schedule: BackupSchedule): Promise<void> {
  const data = {
    enabled: schedule.enabled,
    hour: schedule.hour,
    minute: schedule.minute,
    daysOfWeek: JSON.stringify(schedule.daysOfWeek ?? []),
    maxKeep: schedule.maxKeep,
    encryptionPassword: schedule.encryptionPassword ?? "",
  };
  await db.backupSchedule.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
}
