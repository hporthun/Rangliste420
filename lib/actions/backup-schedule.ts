/**
 * Server-Actions: Backup-Zeitplan + manuelle Backup-Operationen.
 *
 * Was hier lebt:
 * - `getScheduleAction`         — aktuellen Zeitplan lesen
 * - `saveScheduleAction`        — Wochentage / Uhrzeit / Aufbewahrung pflegen
 * - `triggerBackupNowAction`    — sofort ein Backup erstellen (mit optionalem Kommentar)
 * - `getStoredBackupsAction`    — Liste aller im Storage liegenden Backup-Dateien
 * - `deleteStoredBackupAction`  — einzelnes Backup löschen
 *
 * Storage-Layer: `lib/backup/writer.ts` — bedient sowohl Filesystem
 * (lokal) als auch Vercel Blob (production), je nach Env. Diese Schicht
 * ist provider-agnostisch.
 *
 * Schreibt in: `BackupSchedule`-Tabelle (Singleton id=1) plus die
 * konfigurierte Storage. Auf Vercel (Hobby-Plan) ist die Stundenwahl
 * informativ — der Cron läuft einmal täglich um 01:00 UTC, prüft aber
 * die Wochentag-Einstellung.
 *
 * Auth: alle Actions erfordern eine gültige Session.
 */
"use server";

import { auth } from "@/lib/auth";
import { readSchedule, type BackupSchedule } from "@/lib/backup/config";
import { writeBackupFile, deleteBackupFile, listBackups } from "@/lib/backup/writer";
import { revalidatePath } from "next/cache";
import { logAudit, A } from "@/lib/security/audit";

// ── Read current schedule ─────────────────────────────────────────────────────

export async function getScheduleAction(): Promise<
  { ok: true; schedule: BackupSchedule } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  return { ok: true, schedule: await readSchedule() };
}

// ── Save schedule ─────────────────────────────────────────────────────────────

export async function saveScheduleAction(
  schedule: BackupSchedule
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    if (schedule.hour < 0 || schedule.hour > 23)
      return { ok: false, error: "Ungültige Stunde." };
    if (schedule.minute < 0 || schedule.minute > 59)
      return { ok: false, error: "Ungültige Minute." };
    if (schedule.daysOfWeek.some((d) => d < 0 || d > 6))
      return { ok: false, error: "Ungültiger Wochentag." };
    if (!Number.isInteger(schedule.maxKeep) || schedule.maxKeep < 1 || schedule.maxKeep > 365)
      return { ok: false, error: "Aufbewahrung muss zwischen 1 und 365 liegen." };

    // updateAndApplySchedule needs to run in the same process as the scheduler.
    // We dynamically import to avoid bundling node-cron into the action module.
    const { updateAndApplySchedule } = await import("@/lib/backup/scheduler");
    updateAndApplySchedule(schedule);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Manual backup now ─────────────────────────────────────────────────────────

export async function triggerBackupNowAction(
  comment?: string
): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };
    const trimmed = comment?.trim() || undefined;
    const filename = await writeBackupFile(trimmed);
    revalidatePath("/admin/wartung");
    await logAudit({ userId: session.user?.id, action: A.BACKUP_CREATED, detail: filename });
    return { ok: true, filename };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Delete a stored backup ────────────────────────────────────────────────────

export async function deleteStoredBackupAction(
  filename: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };
    const ok = await deleteBackupFile(filename);
    if (!ok) return { ok: false, error: "Datei nicht gefunden oder ungültiger Name." };
    revalidatePath("/admin/wartung");
    await logAudit({ userId: session.user?.id, action: A.BACKUP_DELETED, detail: filename });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── List stored backups (for server component) ────────────────────────────────

export async function getStoredBackupsAction() {
  const session = await auth();
  if (!session) return [];
  return await listBackups();
}
