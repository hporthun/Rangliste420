import * as cron from "node-cron";
import { readSchedule, writeSchedule, type BackupSchedule } from "./config";
import { writeBackupFile } from "./writer";

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function buildAutoComment(schedule: BackupSchedule): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const days =
    schedule.daysOfWeek.length === 0 || schedule.daysOfWeek.length === 7
      ? "täglich"
      : schedule.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");
  return `Automatisches Backup — Zeitplan: ${days} · ${pad(schedule.hour)}:${pad(schedule.minute)} Uhr`;
}

let currentTask: cron.ScheduledTask | null = null;

function buildCronExpression(schedule: BackupSchedule): string {
  const days =
    schedule.daysOfWeek.length === 0 || schedule.daysOfWeek.length === 7
      ? "*"
      : schedule.daysOfWeek.join(",");
  return `${schedule.minute} ${schedule.hour} * * ${days}`;
}

export function applySchedule(schedule: BackupSchedule) {
  // Stop any existing task
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  if (!schedule.enabled) return;

  const expr = buildCronExpression(schedule);
  if (!cron.validate(expr)) {
    console.error("[backup-scheduler] Invalid cron expression:", expr);
    return;
  }

  const autoComment = buildAutoComment(schedule);
  currentTask = cron.schedule(expr, async () => {
    try {
      const filename = await writeBackupFile(autoComment);
      console.log("[backup-scheduler] Backup written:", filename);
    } catch (e) {
      console.error("[backup-scheduler] Backup failed:", e);
    }
  });

  console.log("[backup-scheduler] Scheduled backups:", expr);
}

/** Called once at server start by instrumentation.ts */
export function initBackupScheduler() {
  const schedule = readSchedule();
  applySchedule(schedule);
}

/** Save new schedule to disk and immediately apply it. */
export function updateAndApplySchedule(schedule: BackupSchedule) {
  writeSchedule(schedule);
  applySchedule(schedule);
}
