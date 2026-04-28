import * as cron from "node-cron";
import { readSchedule, writeSchedule, type BackupSchedule } from "./config";
import { writeBackupFile } from "./writer";

/**
 * On Vercel/serverless, every request runs in a fresh function invocation,
 * so a long-running node-cron task cannot survive between requests.
 * Phase 1: skip in-process scheduling — backups must be triggered manually
 * via "Jetzt sichern" or (Phase 2) Vercel Cron Jobs.
 */
const IS_SERVERLESS =
  process.env.VERCEL === "1" ||
  process.env.NEXT_RUNTIME === "edge" ||
  process.env.AWS_EXECUTION_ENV !== undefined;

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

  if (IS_SERVERLESS) {
    // Configuration is still persisted via writeSchedule() so a future
    // Vercel-Cron-based scheduler (Phase 2) can read it.
    console.log(
      "[backup-scheduler] Serverless environment detected — in-process cron disabled. " +
        "Phase 2 will move automated backups to Vercel Cron Jobs."
    );
    return;
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
