/**
 * Server-Actions: Benutzerverwaltung (Issue #49).
 *
 * Admin-only — alle Actions prüfen via `requireRole("ADMIN")`.
 *
 * Was hier lebt:
 * - listUsersAction: Liste aller User inkl. lastLoginAt (aus AuditLog)
 * - createUserAction: User anlegen mit Initialpasswort, Rolle Admin/Editor
 * - updateUserAction: Username/Email/Rolle ändern
 * - resetUserPasswordAction: Passwort durch Admin neu setzen
 * - disableUserAction / enableUserAction: manuelle Sperrung
 * - revokeUserSessionsAction: tokenVersion erhöhen → User wird beim nächsten
 *   Request herausgeworfen
 * - deleteUserAction: User dauerhaft löschen (Cascade auf Passkeys)
 *
 * Selbstschutz: der eingeloggte Admin kann sich nicht selbst sperren,
 * löschen oder zum Editor degradieren.
 *
 * Mindestens-1-Admin: Das System sichert, dass mindestens ein aktiver
 * (nicht gesperrter) Admin existiert. Der letzte Admin kann nicht degradiert,
 * gesperrt oder gelöscht werden.
 *
 * Schreibt in: `User`, `AuditLog`. Lese-Actions schreiben in `AuditLog`
 * nichts (nur Mutationen sind audit-relevant).
 */
"use server";

import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { logAudit, getIp, A } from "@/lib/security/audit";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ── Schemas ───────────────────────────────────────────────────────────────────

const usernameSchema = z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, {
  message: "2–32 Zeichen, nur a–z, 0–9, _ und -",
});
const emailSchema = z.string().email().max(254).or(z.literal(""));
const passwordSchema = z.string().min(10).max(200);
const roleSchema = z.enum(["ADMIN", "EDITOR"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRequestIp() {
  const h = await headers();
  return getIp(h);
}

/**
 * Stellt sicher, dass nach der Mutation noch mindestens ein aktiver Admin
 * existiert. Wird sowohl beim Sperren als auch beim Löschen / Rolle-Ändern
 * eines Admin-Users geprüft.
 */
async function assertAtLeastOneActiveAdminAfter(opts: {
  excludeUserId?: string;
  treatAsDisabled?: boolean;
  treatAsRole?: "ADMIN" | "EDITOR";
}): Promise<string | null> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", disabledAt: null },
    select: { id: true },
  });
  const remaining = admins.filter((a) => {
    if (a.id === opts.excludeUserId) {
      // Wenn die Mutation den User entfernt oder seine Rolle/Status ändert,
      // schließen wir ihn aus der Zählung aus — außer er bleibt Admin und aktiv.
      if (opts.treatAsDisabled) return false;
      if (opts.treatAsRole && opts.treatAsRole !== "ADMIN") return false;
    }
    return true;
  });
  if (remaining.length === 0) {
    return "Mindestens ein aktiver Admin muss erhalten bleiben.";
  }
  return null;
}

// ── List ──────────────────────────────────────────────────────────────────────

export type UserListRow = {
  id: string;
  username: string | null;
  email: string | null;
  role: "ADMIN" | "EDITOR";
  disabledAt: Date | null;
  totpEnabled: boolean;
  passkeyCount: number;
  lastLoginAt: Date | null;
  lastLoginAction: string | null;
  createdAt: Date;
};

const LOGIN_ACTIONS = [A.LOGIN_SUCCESS, A.LOGIN_PASSKEY, A.LOGIN_OAUTH];

export async function listUsersAction(): Promise<Result<UserListRow[]>> {
  await requireRole("ADMIN");

  const users = await db.user.findMany({
    orderBy: [{ disabledAt: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      disabledAt: true,
      totpEnabled: true,
      createdAt: true,
      _count: { select: { webAuthnCredentials: true } },
    },
  });

  const userIds = users.map((u) => u.id);

  // Group by userId — fetch the most recent successful-login audit entry per user.
  // SQLite has no DISTINCT ON; do it in JS.
  const recentLogins = await db.auditLog.findMany({
    where: { userId: { in: userIds }, action: { in: LOGIN_ACTIONS } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, action: true, createdAt: true },
  });

  const lastLoginByUser = new Map<string, { at: Date; action: string }>();
  for (const log of recentLogins) {
    if (!log.userId) continue;
    if (lastLoginByUser.has(log.userId)) continue;
    lastLoginByUser.set(log.userId, { at: log.createdAt, action: log.action });
  }

  const rows: UserListRow[] = users.map((u) => {
    const last = lastLoginByUser.get(u.id);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role as "ADMIN" | "EDITOR",
      disabledAt: u.disabledAt,
      totpEnabled: u.totpEnabled,
      passkeyCount: u._count.webAuthnCredentials,
      lastLoginAt: last?.at ?? null,
      lastLoginAction: last?.action ?? null,
      createdAt: u.createdAt,
    };
  });

  return { ok: true, data: rows };
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateUserInput = {
  username: string;
  email: string;
  password: string;
  role: "ADMIN" | "EDITOR";
};

export async function createUserAction(
  input: CreateUserInput
): Promise<Result<{ id: string }>> {
  const me = await requireRole("ADMIN");

  const parsed = z
    .object({
      username: usernameSchema,
      email: emailSchema,
      password: passwordSchema,
      role: roleSchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const { username, email, password, role } = parsed.data;

  // Conflicts
  const usernameClash = await db.user.findUnique({ where: { username } });
  if (usernameClash) return { ok: false, error: "Benutzername bereits vergeben." };
  if (email) {
    const emailClash = await db.user.findUnique({ where: { email } });
    if (emailClash) return { ok: false, error: "E-Mail bereits vergeben." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await db.user.create({
    data: {
      username,
      email: email || null,
      passwordHash,
      role,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_CREATED,
    detail: `${username} (${role})`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: { id: created.id } };
}

// ── Update (username / email / role) ──────────────────────────────────────────

export type UpdateUserInput = {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "EDITOR";
};

export async function updateUserAction(input: UpdateUserInput): Promise<Result> {
  const me = await requireRole("ADMIN");

  const parsed = z
    .object({
      id: z.string().min(1),
      username: usernameSchema,
      email: emailSchema,
      role: roleSchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const target = await db.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };

  // Selbstschutz: Admin kann sich nicht selbst zum Editor degradieren.
  if (target.id === me.userId && parsed.data.role !== "ADMIN") {
    return { ok: false, error: "Du kannst deine eigene Rolle nicht ändern." };
  }

  // Mindestens 1 aktiver Admin
  if (target.role === "ADMIN" && parsed.data.role === "EDITOR") {
    const err = await assertAtLeastOneActiveAdminAfter({
      excludeUserId: target.id,
      treatAsRole: "EDITOR",
    });
    if (err) return { ok: false, error: err };
  }

  const usernameClash = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (usernameClash && usernameClash.id !== target.id) {
    return { ok: false, error: "Benutzername bereits vergeben." };
  }
  if (parsed.data.email) {
    const emailClash = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (emailClash && emailClash.id !== target.id) {
      return { ok: false, error: "E-Mail bereits vergeben." };
    }
  }

  await db.user.update({
    where: { id: target.id },
    data: {
      username: parsed.data.username,
      email: parsed.data.email || null,
      role: parsed.data.role,
    },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_UPDATED,
    detail: `${parsed.data.username} (Rolle: ${parsed.data.role})`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetUserPasswordAction(
  id: string,
  newPassword: string
): Promise<Result> {
  const me = await requireRole("ADMIN");
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { ok: false, error: "Passwort muss mindestens 10 Zeichen haben." };
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };

  const passwordHash = await bcrypt.hash(parsed.data, 12);

  // Beim Admin-initiated Reset werden auch alle Sessions verworfen, damit
  // der alte Token nicht weiter benutzt werden kann.
  await db.user.update({
    where: { id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_PASSWORD_RESET,
    detail: `${target.username ?? id}`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}

// ── Disable / enable ──────────────────────────────────────────────────────────

export async function disableUserAction(id: string): Promise<Result> {
  const me = await requireRole("ADMIN");

  if (id === me.userId) {
    return { ok: false, error: "Du kannst dich nicht selbst sperren." };
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };
  if (target.disabledAt) return { ok: true, data: undefined }; // bereits gesperrt

  if (target.role === "ADMIN") {
    const err = await assertAtLeastOneActiveAdminAfter({
      excludeUserId: target.id,
      treatAsDisabled: true,
    });
    if (err) return { ok: false, error: err };
  }

  await db.user.update({
    where: { id },
    data: {
      disabledAt: new Date(),
      disabledBy: me.userId,
      // Sperre invalidiert auch sofort die laufenden Sessions
      tokenVersion: { increment: 1 },
    },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_DISABLED,
    detail: `${target.username ?? id}`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}

export async function enableUserAction(id: string): Promise<Result> {
  const me = await requireRole("ADMIN");

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };

  await db.user.update({
    where: { id },
    data: { disabledAt: null, disabledBy: null },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_ENABLED,
    detail: `${target.username ?? id}`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}

// ── Revoke sessions (= Rauswerfen) ────────────────────────────────────────────

export async function revokeUserSessionsAction(id: string): Promise<Result> {
  const me = await requireRole("ADMIN");

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };

  await db.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });

  await logAudit({
    userId: me.userId,
    action: A.USER_SESSIONS_REVOKED,
    detail: `${target.username ?? id}`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteUserAction(id: string): Promise<Result> {
  const me = await requireRole("ADMIN");

  if (id === me.userId) {
    return { ok: false, error: "Du kannst dich nicht selbst löschen." };
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Benutzer nicht gefunden." };

  if (target.role === "ADMIN") {
    const err = await assertAtLeastOneActiveAdminAfter({
      excludeUserId: target.id,
      treatAsDisabled: true,
    });
    if (err) return { ok: false, error: err };
  }

  await db.user.delete({ where: { id } });

  await logAudit({
    userId: me.userId,
    action: A.USER_DELETED,
    detail: `${target.username ?? id} (${target.email ?? "keine E-Mail"})`,
    ip: await getRequestIp(),
  });

  revalidatePath("/admin/benutzer");
  return { ok: true, data: undefined };
}
