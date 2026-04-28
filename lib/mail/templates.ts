/**
 * E-Mail-Templates für die App. Halte den Code bewusst frei von externen
 * Template-Engines — wir senden so wenige verschiedene Mails, dass
 * String-Templates ausreichen.
 */

import type { MailMessage } from "./send";

/** Build the password-reset mail (plain + HTML version). */
export function passwordResetMail(opts: {
  to: string;
  /** Voll qualifizierter Reset-Link, z.B. "https://app.example.com/auth/reset/abc". */
  resetUrl: string;
  /** Wer angesprochen wird — Username oder „Admin". */
  recipientName?: string;
  /** TTL in Minuten zur Information des Empfängers. */
  expiresMinutes?: number;
}): MailMessage {
  const name = opts.recipientName ?? "Admin";
  const ttl = opts.expiresMinutes ?? 60;

  const text = [
    `Hallo ${name},`,
    "",
    "für Ihren Account in der 420er-Rangliste wurde ein Passwort-Reset",
    "angefordert. Über folgenden Link können Sie ein neues Passwort setzen:",
    "",
    opts.resetUrl,
    "",
    `Der Link ist ${ttl} Minuten lang gültig und kann nur einmal verwendet werden.`,
    "",
    "Falls Sie diesen Reset nicht angefordert haben, ignorieren Sie diese",
    "E-Mail — Ihr Passwort bleibt unverändert.",
    "",
    "Viele Grüße",
    "420er-Klassenvereinigung",
  ].join("\n");

  const html = `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 24px auto; padding: 0 16px; color: #1f2937;">
  <h1 style="font-size: 18px; margin: 0 0 16px;">Passwort zurücksetzen</h1>

  <p>Hallo ${escapeHtml(name)},</p>

  <p>für Ihren Account in der <strong>420er-Rangliste</strong> wurde ein
  Passwort-Reset angefordert. Klicken Sie auf den folgenden Button, um ein
  neues Passwort festzulegen:</p>

  <p style="margin: 24px 0;">
    <a href="${opts.resetUrl}"
       style="display: inline-block; padding: 10px 20px; background: #1B3C8E; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Passwort zurücksetzen
    </a>
  </p>

  <p style="font-size: 13px; color: #6b7280;">Falls der Button nicht funktioniert,
  kopieren Sie diesen Link in Ihren Browser:</p>
  <p style="font-size: 12px; word-break: break-all; color: #6b7280;">${opts.resetUrl}</p>

  <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e5e7eb;">

  <p style="font-size: 13px; color: #6b7280;">
    Der Link ist <strong>${ttl} Minuten</strong> lang gültig und kann nur einmal
    verwendet werden. Falls Sie diesen Reset nicht angefordert haben,
    ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.
  </p>

  <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
    420er-Klassenvereinigung
  </p>
</body>
</html>`;

  return {
    to: opts.to,
    subject: "Passwort zurücksetzen — 420er-Rangliste",
    text,
    html,
  };
}

/** Minimal HTML-Escape für nutzergesteuerte Variablen im HTML-Body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
