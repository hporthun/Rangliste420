/**
 * Minimal TOTP (RFC 6238) implementation using the Web Crypto API.
 * Works in Node.js 18+, Edge Runtime, and browsers — no Node.js-only imports.
 */

// ── Base32 ─────────────────────────────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const s = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of s) {
    const idx = BASE32_CHARS.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Allocate a fresh ArrayBuffer so TypeScript sees Uint8Array<ArrayBuffer>
  const arr = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) arr[i] = out[i];
  return arr;
}

// ── TOTP (Web Crypto) ──────────────────────────────────────────────────────────

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // ±1 step tolerance for clock skew

export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret);

  // 8-byte big-endian counter
  const counterBuf = new Uint8Array(8);
  const view = new DataView(counterBuf.buffer);
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  view.setUint32(0, hi, false);
  view.setUint32(4, lo, false);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, counterBuf.buffer.slice(0));
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function currentCounter(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD);
}

export async function generateTotpCode(secret: string, now = Date.now()): Promise<string> {
  return hotp(secret, currentCounter(now));
}

export async function verifyTotpCode(token: string, secret: string, now = Date.now()): Promise<boolean> {
  const t = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const c = currentCounter(now);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    if ((await hotp(secret, c + delta)) === t) return true;
  }
  return false;
}

export function totpKeyUri(accountName: string, issuer: string, secret: string): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
  );
}
