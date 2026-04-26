/**
 * In-memory sliding-window rate limiter.
 * Works for a single-server setup (no Redis needed).
 * State resets on server restart.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Purge stale entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [key, entry] of store) {
    if (entry.timestamps.every((t) => t < cutoff)) store.delete(key);
  }
}, 10 * 60_000);

/**
 * Check if a key (e.g. IP address) has exceeded the rate limit.
 *
 * @param key        Unique identifier (IP, user ID, etc.)
 * @param maxRequests  Max allowed requests in the window
 * @param windowMs   Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}
