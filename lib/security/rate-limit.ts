/**
 * Persistenter Sliding-Window-Rate-Limiter (Issue #59).
 *
 * Speichert die Counter in der `RateLimitEntry`-Tabelle, damit Vercel-
 * Serverless-Instanzen sich nicht ihren eigenen In-Memory-Stand basteln.
 * Cleanup laeuft lazy beim Lesen — sobald alle Timestamps eines Eintrags
 * ausserhalb des Fensters liegen, wird der Eintrag verworfen statt
 * fortgeschrieben. Bei Bedarf kann ein Maintenance-Job zusaetzlich
 * aufraeumen (siehe `purgeStaleRateLimitEntries`).
 *
 * Race-Toleranz: Bei zwei parallelen Requests auf denselben Key kann es
 * passieren, dass beide den vorigen Stand lesen und nur einer von beiden
 * gezaehlt wird (last-write-wins). Fuer Brute-Force-Schutz im Login-
 * Endpoint ist das akzeptabel — der per-User-Lockout in lib/auth.ts
 * (10 Failures -> 30 min DB-Lock) bleibt das eigentliche Stop-Layer.
 */

import { db } from "@/lib/db/client";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Pruefen, ob ein Key (z.B. "login:1.2.3.4") das Limit ueberschritten hat
 * UND den Versuch bei Erlaubnis fortschreiben.
 *
 * @param key          Eindeutiger Identifier (IP, User-ID, etc.)
 * @param maxRequests  Maximal erlaubte Versuche im Window
 * @param windowMs     Window-Groesse in Millisekunden
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = await db.rateLimitEntry.findUnique({ where: { key } });
  const previous = existing ? parseTimestamps(existing.timestamps) : [];
  const window = previous.filter((t) => t >= cutoff);

  if (window.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: window[0] + windowMs,
    };
  }

  const next = [...window, now];
  await db.rateLimitEntry.upsert({
    where: { key },
    create: { key, timestamps: JSON.stringify(next) },
    update: { timestamps: JSON.stringify(next) },
  });

  return {
    allowed: true,
    remaining: maxRequests - next.length,
    resetAt: now + windowMs,
  };
}

/**
 * Loescht den Counter fuer `key` — wird nach erfolgreichem Login
 * aufgerufen, damit der Benutzer nach dem 9. Fehlversuch und einem
 * Erfolg nicht trotzdem ausgesperrt wird.
 */
export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimitEntry.deleteMany({ where: { key } });
}

/**
 * Optionaler Maintenance-Helper: entfernt Eintraege, die seit `maxAgeMs`
 * nicht mehr aktualisiert wurden. Wird aktuell nicht automatisch
 * aufgerufen — die Lazy-Filterung in `checkRateLimit` reicht fuer das
 * heutige Volumen. Bereitgestellt fuer einen optionalen Cron-Cleanup,
 * falls die Tabelle bei Skalierung wachsen sollte.
 */
export async function purgeStaleRateLimitEntries(
  maxAgeMs: number = 24 * 60 * 60_000
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const { count } = await db.rateLimitEntry.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });
  return count;
}

function parseTimestamps(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === "number");
  } catch {
    return [];
  }
}
