import path from "path";
import fs from "fs";
import type { BackupSchedule } from "./types";

export type { BackupSchedule };

// Directory where backup JSON files and the schedule config are stored.
// Override with env var BACKUP_DIR (absolute or relative to cwd).
export const BACKUP_DIR = path.resolve(
  process.env.BACKUP_DIR ?? path.join(process.cwd(), "data", "backups")
);

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
