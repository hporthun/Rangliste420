/**
 * Push-Konfiguration aus den ENV-Variablen (Issue #36).
 *
 * VAPID-Keys werden einmalig per `node scripts/generate-vapid.mjs` erzeugt
 * und in `.env` (lokal) bzw. Vercel-Env (Produktion) hinterlegt. Wenn die
 * Werte fehlen, ist Push deaktiviert: das Banner wird nicht angeboten und
 * die /api/push/*-Endpoints liefern 503.
 */

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPushEnabled(): boolean {
  return getPushConfig() !== null;
}
