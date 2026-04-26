/**
 * WebAuthn Relying Party configuration.
 * RP_ID must match the hostname (no port) where the app runs.
 */
export const RP_NAME = "420er Rangliste";
export const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
export const ORIGIN =
  process.env.WEBAUTHN_ORIGIN ??
  (process.env.NODE_ENV === "production"
    ? `https://${RP_ID}`
    : `http://${RP_ID}:${process.env.PORT ?? 3000}`);

/** Passkey session tokens expire after 60 seconds */
export const PASSKEY_SESSION_TTL_MS = 60_000;
/** WebAuthn challenges expire after 5 minutes */
export const CHALLENGE_TTL_MS = 5 * 60_000;
