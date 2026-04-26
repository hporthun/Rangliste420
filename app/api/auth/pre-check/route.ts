import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAudit, getIp, A } from "@/lib/security/audit";

// ── Config ─────────────────────────────────────────────────────────────────────

/** 10 attempts per IP per 15 minutes */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/auth/pre-check
 * Verifies credentials without creating a session.
 * Returns { needsTotp: boolean } on success.
 * Rate-limited per IP: 10 attempts / 15 min.
 */
export async function POST(req: NextRequest) {
  const ip = getIp(req.headers);

  // ── Rate limit ───────────────────────────────────────────────────────────────
  const rl = checkRateLimit(`login:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000);
    await logAudit({ action: A.LOGIN_FAILED, detail: `Rate limit (IP: ${ip})`, ip });
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einige Minuten." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const { identifier, password } = parsed.data;

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
    select: { id: true, passwordHash: true, totpEnabled: true, lockedUntil: true, failedLoginAttempts: true },
  });

  // ── Account lockout check ────────────────────────────────────────────────────
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      { error: `Account gesperrt. Bitte in ${minutesLeft} Minute(n) erneut versuchen.` },
      { status: 423 }
    );
  }

  if (!user || !user.passwordHash) {
    // Constant-time delay to avoid timing-based user enumeration
    await bcrypt.compare(password, "$2b$12$invalidhashpadding.......................X");
    return NextResponse.json({ error: "Ungültiger Benutzername oder Passwort." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Ungültiger Benutzername oder Passwort." }, { status: 401 });
  }

  return NextResponse.json({
    needsTotp: user.totpEnabled,
    remaining: rl.remaining,
  });
}
