/**
 * E-Mail-Versand-Schicht.
 *
 * Aktuell unterstützt: SMTP via nodemailer. Konfiguration läuft komplett
 * über Env-Vars — wenn `SMTP_HOST` nicht gesetzt ist, wird die Mail nicht
 * verschickt sondern in die Server-Konsole geloggt (Dev-Modus).
 *
 * Erforderliche Env-Vars im Produktivbetrieb:
 *   SMTP_HOST       z.B. "smtp.strato.de"
 *   SMTP_PORT       587 (STARTTLS) oder 465 (SSL/TLS); Default 587
 *   SMTP_USER       Login-Username
 *   SMTP_PASS       Login-Passwort
 *   MAIL_FROM       Absender, z.B. "noreply@meine-domain.de"
 */

import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  /** Plain-text body (Pflicht für Spam-Filter und a11y). */
  text: string;
  /** Optionaler HTML-Body. Wird ohne `text` ignoriert. */
  html?: string;
};

export type MailResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: string; transport: "missing" };

let cached: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cached) return cached;
  if (!process.env.SMTP_HOST) return null;

  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 = implicit TLS, alle anderen (z.B. 587) = STARTTLS
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ?? "",
        }
      : undefined,
  });
  return cached;
}

/**
 * Versendet eine E-Mail. Wirft niemals — Fehler kommen als
 * `{ ok: false, error }` zurück, damit Aufrufer sie kontrolliert
 * an User oder Audit-Log weiterreichen können.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev-Modus oder fehlende Konfiguration: nicht abbrechen, nur loggen.
    // Caller (z.B. generateResetTokenAction) entscheidet, ob das ein
    // Fehlerfall ist.
    console.warn(
      "[mail] SMTP nicht konfiguriert — Nachricht wurde nicht versendet:\n",
      `  to:      ${msg.to}\n  subject: ${msg.subject}\n  text:\n${msg.text}`
    );
    return { ok: false, error: "Kein SMTP-Transport konfiguriert.", transport: "missing" };
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? "noreply@420er-rangliste.local",
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Boolean-Helper für UI: zeigt Aufrufern an, dass kein Versand möglich ist. */
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}
