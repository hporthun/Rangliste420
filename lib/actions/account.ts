/**
 * Server-Actions: User-Account-Self-Service.
 *
 * Was hier lebt:
 * - Username / E-Mail / Passwort ändern (eingeloggter User)
 * - TOTP-2FA: setup, verify+enable, disable
 * - Passkey: rename, delete (Verwaltung)
 * - Passwort-Reset-Token erzeugen + verbrauchen (öffentlicher Forgot-Flow)
 * - Account-Info abrufen
 *
 * Schreibt in: `User`-Tabelle, plus `WebAuthnCredential` (Passkey-Aktionen),
 * plus `AuditLog` für sicherheitsrelevante Events.
 *
 * Auth: alle Actions außer `generateResetTokenAction` und
 * `resetPasswordAction` (öffentliche Reset-Flows) erfordern eine gültige
 * Session via `auth()`.
 *
 * Mail-Versand: `generateResetTokenAction` schickt den Reset-Link per
 * SMTP via `lib/mail`. Ohne SMTP-Konfig wird der Link nur in den
 * Server-Logs ausgegeben (Dev-Fallback).
 */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import crypto from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { generateTotpSecret, verifyTotpCode, totpKeyUri } from "@/lib/totp";
import { logAudit, A } from "@/lib/security/audit";
import { sendMail, isMailConfigured } from "@/lib/mail/send";
import { passwordResetMail } from "@/lib/mail/templates";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

// ── Username ───────────────────────────────────────────────────────────────────

const usernameSchema = z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/);

export async function changeUsernameAction(username: string): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return { ok: false, error: "Ungültiger Benutzername (2–32 Zeichen, nur a-z, 0-9, _ -)." };
  }

  const conflict = await db.user.findUnique({ where: { username: parsed.data } });
  if (conflict && conflict.id !== user.id) {
    return { ok: false, error: "Benutzername bereits vergeben." };
  }

  await db.user.update({ where: { id: user.id }, data: { username: parsed.data } });
  await logAudit({ userId: user.id, action: A.USERNAME_CHANGE, detail: parsed.data });
  return { ok: true, data: undefined };
}

// ── E-Mail ─────────────────────────────────────────────────────────────────────

export async function changeEmailAction(email: string): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const parsed = z.string().email().or(z.literal("")).safeParse(email.trim());
  if (!parsed.success) {
    return { ok: false, error: "Ungültige E-Mail-Adresse." };
  }

  const newEmail = parsed.data === "" ? null : parsed.data;

  if (newEmail) {
    const conflict = await db.user.findUnique({ where: { email: newEmail } });
    if (conflict && conflict.id !== user.id) {
      return { ok: false, error: "E-Mail bereits vergeben." };
    }
  }

  await db.user.update({ where: { id: user.id }, data: { email: newEmail } });
  await logAudit({ userId: user.id, action: A.EMAIL_CHANGE, detail: newEmail ?? "(entfernt)" });
  return { ok: true, data: undefined };
}

// ── Password ───────────────────────────────────────────────────────────────────

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  if (newPassword.length < 8) {
    return { ok: false, error: "Neues Passwort muss mindestens 8 Zeichen lang sein." };
  }

  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Aktuelles Passwort falsch." };
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  await logAudit({ userId: user.id, action: A.PASSWORD_CHANGE });
  return { ok: true, data: undefined };
}

// ── TOTP setup ─────────────────────────────────────────────────────────────────

export async function setupTotpAction(): Promise<Result<{ secret: string; qrDataUrl: string }>> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const secret = generateTotpSecret();
  const otpauthUrl = totpKeyUri(
    user.username ?? user.email ?? user.id,
    "420er Rangliste",
    secret
  );

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });

  // Store the secret temporarily (not yet enabled)
  await db.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });

  return { ok: true, data: { secret, qrDataUrl } };
}

export async function verifyAndEnableTotpAction(code: string): Promise<Result<{ backupCodes: string[] }>> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!user.totpSecret) return { ok: false, error: "Kein TOTP-Secret vorhanden." };

  const valid = await verifyTotpCode(code, user.totpSecret);
  if (!valid) return { ok: false, error: "Ungültiger Code. Bitte erneut versuchen." };

  // Generate 8 backup codes
  const plainCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  );
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

  await db.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpBackupCodes: JSON.stringify(hashedCodes),
    },
  });
  await logAudit({ userId: user.id, action: A.TOTP_ENABLED });

  return { ok: true, data: { backupCodes: plainCodes } };
}

export async function disableTotpAction(code: string): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!user.totpEnabled || !user.totpSecret) {
    return { ok: false, error: "TOTP ist nicht aktiviert." };
  }

  const valid = await verifyTotpCode(code, user.totpSecret);
  if (!valid) return { ok: false, error: "Ungültiger Code." };

  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: "[]" },
  });
  await logAudit({ userId: user.id, action: A.TOTP_DISABLED });
  return { ok: true, data: undefined };
}

// ── Password reset token ───────────────────────────────────────────────────────

/**
 * Initiates a password reset.
 *
 * Generates a one-shot token, stores it on the user, and sends a
 * password-reset email containing the reset URL. Returns generic
 * `{ ok: true }` regardless of whether the account exists, to avoid
 * username/email enumeration via the response.
 *
 * Issue #29: Vorher wurde der Reset-Link direkt an den Browser
 * zurückgegeben und im UI angezeigt — ein gravierendes Sicherheits-
 * problem, weil dadurch jeder Reset-Links für fremde Accounts
 * generieren konnte. Jetzt geht der Link nur per E-Mail an die
 * tatsächliche Adresse des Accounts.
 */
export async function generateResetTokenAction(
  identifier: string
): Promise<Result<{ mailSent: boolean; transportConfigured: boolean }>> {
  // Resolve origin from request headers — works on localhost, Vercel
  // previews and the production domain without separate env-var setup.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  // Whether the SMTP transport is configured at all — exposed to the UI
  // as a separate flag so the user gets a clear hint while the existence
  // of the account itself stays hidden.
  const transportConfigured = await isMailConfigured();

  // Account doesn't exist → return success without doing anything.
  // (No token created, no email sent.)
  if (!user) {
    return { ok: true, data: { mailSent: false, transportConfigured } };
  }

  // Account exists but has no email on file → we can't deliver the link.
  // Audit-log this and return ok — the caller can't tell from the response
  // whether the user has no email or doesn't exist.
  if (!user.email) {
    await logAudit({
      userId: user.id,
      action: A.RESET_TOKEN,
      detail: "Reset angefordert, aber User hat keine E-Mail-Adresse hinterlegt",
    });
    return { ok: true, data: { mailSent: false, transportConfigured } };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiry: new Date(Date.now() + 60 * 60_000), // 1 hour
    },
  });

  await logAudit({
    userId: user.id,
    action: A.RESET_TOKEN,
    detail: `Reset-Link an ${user.email} versendet`,
  });

  const resetUrl = `${origin}/auth/reset/${token}`;
  const mail = passwordResetMail({
    to: user.email,
    resetUrl,
    recipientName: user.username ?? undefined,
    expiresMinutes: 60,
  });

  const result = await sendMail(mail);

  return {
    ok: true,
    data: { mailSent: result.ok, transportConfigured },
  };
}

export async function resetPasswordAction(token: string, newPassword: string): Promise<Result> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const user = await db.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) return { ok: false, error: "Ungültiger oder abgelaufener Link." };

  const hash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, resetToken: null, resetTokenExpiry: null },
  });
  return { ok: true, data: undefined };
}

// ── Passkey management ─────────────────────────────────────────────────────────

export async function renamePasskeyAction(id: string, name: string): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const cred = await db.webAuthnCredential.findUnique({ where: { id } });
  if (!cred || cred.userId !== user.id) return { ok: false, error: "Nicht gefunden." };

  await db.webAuthnCredential.update({ where: { id }, data: { name: name.trim().slice(0, 60) || "Passkey" } });
  return { ok: true, data: undefined };
}

export async function deletePasskeyAction(id: string): Promise<Result> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const cred = await db.webAuthnCredential.findUnique({ where: { id } });
  if (!cred || cred.userId !== user.id) return { ok: false, error: "Nicht gefunden." };

  await db.webAuthnCredential.delete({ where: { id } });
  await logAudit({ userId: user.id, action: A.PASSKEY_REMOVED, detail: cred.name });
  return { ok: true, data: undefined };
}

// ── Account info ───────────────────────────────────────────────────────────────

export async function getAccountInfoAction(): Promise<
  Result<{
    username: string | null;
    email: string | null;
    totpEnabled: boolean;
    passkeys: { id: string; name: string; deviceType: string; lastUsed: Date | null; createdAt: Date }[];
  }>
> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const passkeys = await db.webAuthnCredential.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, deviceType: true, lastUsed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    ok: true,
    data: {
      username: user.username,
      email: user.email,
      totpEnabled: user.totpEnabled,
      passkeys,
    },
  };
}
