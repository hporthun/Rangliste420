/**
 * E-Mail-Versand-Schicht.
 *
 * Auflösungsreihenfolge der SMTP-Konfiguration:
 *   1. Datenbank-Tabelle `MailConfig` (Singleton, id=1) — gepflegt über
 *      die Admin-Oberfläche unter /admin/mail (Issue #32). Wenn das
 *      `enabled`-Flag gesetzt ist und ein Host vorliegt, wird diese
 *      Konfiguration genutzt.
 *   2. Env-Vars `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` /
 *      `MAIL_FROM` — bestehender Pfad, dient als Fallback.
 *   3. Keine Konfiguration → Mail wird nicht versendet, Inhalt wandert
 *      stattdessen in die Server-Konsole (Dev-Modus).
 */

import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db/client";

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

/**
 * Resolved SMTP credentials. Built per-call (no module-level cache) so that
 * UI changes in /admin/mail take effect without a server restart.
 */
type ResolvedConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** Where the config was read from — used in error messages and the UI. */
  source: "database" | "env";
};

async function resolveConfig(): Promise<ResolvedConfig | null> {
  // Try DB first.
  try {
    const row = await db.mailConfig.findUnique({ where: { id: 1 } });
    if (row?.enabled && row.host.trim().length > 0) {
      return {
        host: row.host,
        port: row.port,
        user: row.username,
        pass: row.password,
        from: row.fromAddr || row.username,
        source: "database",
      };
    }
  } catch {
    // Table may not exist yet (migration not applied) — silently fall
    // back to env vars.
  }

  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "noreply@420er-rangliste.local",
      source: "env",
    };
  }

  return null;
}

function buildTransporter(cfg: ResolvedConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // Port 465 = implicit TLS, alle anderen (z.B. 587) = STARTTLS
    secure: cfg.port === 465,
    auth: cfg.user
      ? { user: cfg.user, pass: cfg.pass }
      : undefined,
  });
}

/**
 * Versendet eine E-Mail. Wirft niemals — Fehler kommen als
 * `{ ok: false, error }` zurück, damit Aufrufer sie kontrolliert
 * an User oder Audit-Log weiterreichen können.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.warn(
      "[mail] SMTP nicht konfiguriert — Nachricht wurde nicht versendet:\n",
      `  to:      ${msg.to}\n  subject: ${msg.subject}\n  text:\n${msg.text}`
    );
    return { ok: false, error: "Kein SMTP-Transport konfiguriert.", transport: "missing" };
  }

  try {
    const transporter = buildTransporter(cfg);
    await transporter.sendMail({
      from: cfg.from,
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

/**
 * Whether *some* SMTP transport is available (DB-stored or env-provided).
 * Used by the UI to surface the "no SMTP configured" warning banner.
 */
export async function isMailConfigured(): Promise<boolean> {
  const cfg = await resolveConfig();
  return cfg !== null;
}

/**
 * Where the active SMTP config comes from. Returns null when nothing is
 * configured. Useful for diagnostic output in the admin Mail-Settings page.
 */
export async function getMailConfigSource(): Promise<"database" | "env" | null> {
  const cfg = await resolveConfig();
  return cfg?.source ?? null;
}
