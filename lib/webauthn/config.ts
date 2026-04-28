/**
 * WebAuthn Relying Party configuration.
 *
 * RP_ID must match the hostname (no port) where the app runs. To make this
 * work across local dev, Vercel previews and Vercel production without
 * needing per-deployment env vars, we derive the RP_ID and origin from the
 * actual request's Host / X-Forwarded-Proto headers each time. Optional
 * env-var overrides exist for setups where the public-facing hostname
 * differs from the one in the Host header (rare).
 */

import { headers } from "next/headers";

export const RP_NAME = "420er Rangliste";

/** WebAuthn challenges expire after 5 minutes */
export const CHALLENGE_TTL_MS = 5 * 60_000;

/** Passkey session tokens expire after 60 seconds */
export const PASSKEY_SESSION_TTL_MS = 60_000;

export type WebAuthnRP = {
  rpID: string;
  origin: string;
  rpName: string;
};

/**
 * Derive the WebAuthn relying-party config from a request.
 *
 * Accepts either a plain `Headers` object (from a Route Handler `req.headers`
 * or `Request.headers`) or `null`/`undefined` to fall back to the Next.js
 * `headers()` server context. Inside any Route Handler / Server Action /
 * Server Component you can pass `null` and let the helper grab the headers
 * itself.
 *
 * Resolution order:
 *   1. Explicit env vars `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` — useful in
 *      multi-domain or test setups.
 *   2. `host` header (+ `x-forwarded-proto` for the protocol) — works on
 *      localhost, Vercel previews and Vercel production without any config.
 *   3. Hard-coded `localhost:3000` fallback (should never be reached at
 *      runtime).
 */
export async function getWebAuthnRP(
  reqHeaders?: Headers | null
): Promise<WebAuthnRP> {
  const envRpID = process.env.WEBAUTHN_RP_ID;
  const envOrigin = process.env.WEBAUTHN_ORIGIN;
  if (envRpID && envOrigin) {
    return { rpID: envRpID, origin: envOrigin, rpName: RP_NAME };
  }

  const h = reqHeaders ?? (await headers());
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  // RP_ID must be the hostname WITHOUT port per WebAuthn spec.
  const rpID = envRpID ?? host.split(":")[0];
  const origin = envOrigin ?? `${proto}://${host}`;

  return { rpID, origin, rpName: RP_NAME };
}
