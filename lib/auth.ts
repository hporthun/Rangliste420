import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { verifyTotpCode } from "@/lib/totp";
import { logAudit, getIp, A } from "@/lib/security/audit";
import { resetRateLimit } from "@/lib/security/rate-limit";

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60_000; // 30 minutes

// ── Schema ─────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().optional().default(""),
  totpCode: z.string().optional().default(""),
  passkeyToken: z.string().optional().default(""),
});

// ── Auth handler ───────────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,   // 8 hours
    updateAge: 60 * 60,    // refresh token every hour
  },

  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { identifier, password, totpCode, passkeyToken } = parsed.data;
        const ip = getIp(request?.headers ?? new Headers());

        // ── Passkey path ─────────────────────────────────────────────────────
        if (passkeyToken) {
          const record = await db.webAuthnChallenge.findUnique({
            where: { challenge: passkeyToken },
          });
          if (!record || record.type !== "passkey-session" || !record.userId) return null;
          if (record.expiresAt < new Date()) {
            await db.webAuthnChallenge.delete({ where: { id: record.id } });
            return null;
          }
          await db.webAuthnChallenge.delete({ where: { id: record.id } });

          const user = await db.user.findUnique({ where: { id: record.userId } });
          if (!user) return null;

          await logAudit({ userId: user.id, action: A.LOGIN_PASSKEY, ip });
          return { id: user.id, name: user.username ?? user.email ?? user.id, email: user.email ?? "", role: user.role };
        }

        // ── Password path ────────────────────────────────────────────────────
        if (!password) return null;

        const user = await db.user.findFirst({
          where: { OR: [{ username: identifier }, { email: identifier }] },
        });

        // ── Account lockout check ────────────────────────────────────────────
        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
          await logAudit({ userId: user.id, action: A.LOGIN_LOCKED, detail: `${minutesLeft}min verbleibend`, ip });
          return null;
        }

        if (!user || !user.passwordHash) {
          // Constant-time delay to prevent user enumeration
          await bcrypt.compare(password, "$2b$12$invalidhashpadding.......................X");
          await logAudit({ action: A.LOGIN_FAILED, detail: identifier, ip });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          // Increment failure counter
          const newCount = user.failedLoginAttempts + 1;
          const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newCount,
              lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
            },
          });
          await logAudit({
            userId: user.id,
            action: shouldLock ? A.LOGIN_LOCKED : A.LOGIN_FAILED,
            detail: shouldLock ? "Account gesperrt nach zu vielen Fehlversuchen" : `Versuch ${newCount}`,
            ip,
          });
          return null;
        }

        // ── TOTP check ───────────────────────────────────────────────────────
        if (user.totpEnabled && user.totpSecret) {
          if (!totpCode) return null;

          const totpValid = await verifyTotpCode(totpCode, user.totpSecret);
          if (!totpValid) {
            // Try backup codes
            const backupCodes: string[] = JSON.parse(user.totpBackupCodes);
            let usedIndex = -1;
            for (let i = 0; i < backupCodes.length; i++) {
              if (await bcrypt.compare(totpCode.trim().toUpperCase(), backupCodes[i])) {
                usedIndex = i;
                break;
              }
            }
            if (usedIndex === -1) {
              await logAudit({ userId: user.id, action: A.LOGIN_FAILED, detail: "Ungültiger TOTP-Code", ip });
              return null;
            }
            backupCodes.splice(usedIndex, 1);
            await db.user.update({
              where: { id: user.id },
              data: { totpBackupCodes: JSON.stringify(backupCodes) },
            });
          }
        }

        // ── Login successful ─────────────────────────────────────────────────
        // Reset failure counter + rate limit
        await db.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        resetRateLimit(`login:${ip}`);

        await logAudit({ userId: user.id, action: A.LOGIN_SUCCESS, detail: identifier, ip });

        return {
          id: user.id,
          name: user.username ?? user.email ?? user.id,
          email: user.email ?? "",
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.username = (user as { name?: string }).name ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },
});
