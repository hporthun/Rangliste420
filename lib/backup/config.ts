import path from "path";
import fs from "fs";
import type { BackupSchedule } from "./types";

export type { BackupSchedule };

/** Detect a serverless platform where the filesystem is read-only outside /tmp. */
export const IS_SERVERLESS =
  process.env.VERCEL === "1" || process.env.AWS_EXECUTION_ENV !== undefined;

// Directory where backup JSON files and the schedule config are stored.
// Override with env var BACKUP_DIR (absolute or relative to cwd).
//
// Defaults:
//   local        → ./data/backups
//   serverless   → /tmp/420ranking-backups (writeable but ephemeral —
//                   Phase 2 will move backup storage to Vercel Blob)
function getDefaultBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (IS_SERVERLESS) return "/tmp/420ranking-backups";
  return path.join(process.cwd(), "data", "backups");
}
export const BACKUP_DIR = path.resolve(getDefaultBackupDir());

export const SCHEDULE_FILE = path.join(BACKUP_DIR, "_schedule.json");

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

export function readSchedule(): BackupSchedule {
  try {
    ensureBackupDir();
    const raw = fs.readFileSync(SCHEDULE_FILE, "utf-8");
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function writeSchedule(schedule: BackupSchedule) {
  ensureBackupDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2), "utf-8");
}
