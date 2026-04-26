"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import crypto from "crypto";
import { z } from "zod";
import { generateTotpSecret, verifyTotpCode, totpKeyUri } from "@/lib/totp";
import { logAudit, A } from "@/lib/security/audit";

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
 * Generates a password reset token for the given identifier (username or email).
 * Returns the token (to be embedded in the reset URL).
 * This is intentionally unauthenticated — used from the /auth/forgot page.
 */
export async function generateResetTokenAction(
  identifier: string
): Promise<Result<{ token: string }>> {
  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  if (!user) {
    // Always return ok to avoid enumeration
    return { ok: true, data: { token: "" } };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiry: new Date(Date.now() + 60 * 60_000), // 1 hour
    },
  });

  return { ok: true, data: { token } };
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
