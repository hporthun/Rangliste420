/**
 * Audit logging — writes security-relevant events to the AuditLog table.
 * Never throws: logging failures are swallowed so they don't block main actions.
 */

import { db } from "@/lib/db/client";

// ── Action constants ───────────────────────────────────────────────────────────

export const A = {
  // Auth
  LOGIN_SUCCESS:   "LOGIN_SUCCESS",
  LOGIN_FAILED:    "LOGIN_FAILED",
  LOGIN_LOCKED:    "LOGIN_LOCKED",
  LOGIN_PASSKEY:   "LOGIN_PASSKEY",
  LOGOUT:          "LOGOUT",
  RESET_TOKEN:     "RESET_TOKEN",
  PASSWORD_RESET:  "PASSWORD_RESET",

  // Account changes
  USERNAME_CHANGE: "USERNAME_CHANGE",
  EMAIL_CHANGE:    "EMAIL_CHANGE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  TOTP_ENABLED:    "TOTP_ENABLED",
  TOTP_DISABLED:   "TOTP_DISABLED",
  PASSKEY_ADDED:   "PASSKEY_ADDED",
  PASSKEY_REMOVED: "PASSKEY_REMOVED",

  // Data operations
  DATA_DELETE_ALL: "DATA_DELETE_ALL",
  DATA_PRUNE:      "DATA_PRUNE",
  BACKUP_CREATED:  "BACKUP_CREATED",
  BACKUP_RESTORED: "BACKUP_RESTORED",
  BACKUP_DELETED:  "BACKUP_DELETED",
  SAILOR_MERGED:   "SAILOR_MERGED",
} as const;

export type AuditAction = (typeof A)[keyof typeof A];

// ── Log helper ─────────────────────────────────────────────────────────────────

export async function logAudit({
  userId,
  action,
  detail,
  ip,
}: {
  userId?: string | null;
  action: AuditAction | string;
  detail?: string;
  ip?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: { userId: userId ?? null, action, detail, ip },
    });
  } catch {
    console.error("[audit] Failed to write log:", action, detail);
  }
}

// ── IP helper ──────────────────────────────────────────────────────────────────

export function getIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
