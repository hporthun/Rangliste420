/**
 * Server-Actions: SMTP-Konfiguration über das Web-Interface.
 *
 * Was hier lebt:
 * - `getMailConfigAction` — Konfig lesen (Passwort wird NIE zurückgegeben,
 *   nur `hasPassword: boolean` zur Anzeige)
 * - `saveMailConfigAction` — Konfig schreiben. Leeres Passwort-Feld =
 *   bestehender Wert wird behalten (Sicherheits-Konvention)
 * - `testMailConfigAction` — Test-Mail verschicken; akzeptiert auch
 *   nicht-gespeicherte Form-Werte, sodass der Admin vor dem Save
 *   prüfen kann
 *
 * Schreibt in: `MailConfig`-Tabelle (Singleton id=1).
 *
 * Auth: alle Actions erfordern eine gültige Session.
 *
 * Anwendung: `lib/mail/send.ts:resolveConfig()` liest erst aus dieser
 * Tabelle (wenn `enabled=true`), fällt sonst auf `SMTP_*`-Env-Vars
 * zurück. So lassen sich SMTP-Credentials ändern ohne Re-Deploy.
 */
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

export type MailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  /** Always returned empty to clients — see {@link getMailConfigAction}. */
  password: string;
  /** True iff a non-empty password is stored (so the UI can render
   *  "Passwort gesetzt — leer lassen, um es beizubehalten"). */
  hasPassword: boolean;
  fromAddr: string;
};

const SINGLETON_ID = 1;

const saveSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().trim().max(255),
  /** Empty string means "keep existing password". */
  password: z.string().max(1024),
  fromAddr: z.string().trim().max(255),
});

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Read the SMTP configuration for the admin UI. Never returns the actual
 * password — only a boolean indicating whether one is stored. The form
 * uses that to label the password field appropriately.
 */
export async function getMailConfigAction(): Promise<Result<MailConfig>> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const row = await db.mailConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    return {
      ok: true,
      data: {
        enabled: false,
        host: "",
        port: 587,
        username: "",
        password: "",
        hasPassword: false,
        fromAddr: "",
      },
    };
  }
  return {
    ok: true,
    data: {
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      username: row.username,
      password: "",
      hasPassword: row.password.length > 0,
      fromAddr: row.fromAddr,
    },
  };
}

/**
 * Persist the SMTP configuration. If the password field is empty, the
 * existing stored password is kept (the UI doesn't echo the password back
 * for security, so we need this signal to mean "no change").
 */
export async function saveMailConfigAction(
  input: z.infer<typeof saveSchema>
): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const data = parsed.data;

  const existing = await db.mailConfig.findUnique({ where: { id: SINGLETON_ID } });

  // Empty password → keep the stored one. New password → store it.
  const password = data.password === "" ? existing?.password ?? "" : data.password;

  await db.mailConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      username: data.username,
      password,
      fromAddr: data.fromAddr,
    },
    update: {
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      username: data.username,
      password,
      fromAddr: data.fromAddr,
    },
  });

  revalidatePath("/admin/mail");
  return { ok: true, data: undefined };
}

const testSchema = z.object({
  to: z.string().email(),
  /** Optional override for testing un-saved settings; falls back to DB. */
  config: saveSchema.optional(),
});

/**
 * Send a one-off test mail using either the supplied (un-saved) form
 * values or the currently persisted config. Lets the admin verify the
 * SMTP credentials before committing them.
 */
export async function testMailConfigAction(
  input: z.infer<typeof testSchema>
): Promise<Result<{ to: string }>> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const { to, config } = parsed.data;

  // Resolve effective config — either the form values (with empty pw
  // meaning "use stored pw") or whatever is currently persisted.
  let host: string, port: number, user: string, pass: string, from: string;
  if (config) {
    const stored = await db.mailConfig.findUnique({ where: { id: SINGLETON_ID } });
    host = config.host;
    port = config.port;
    user = config.username;
    pass = config.password === "" ? stored?.password ?? "" : config.password;
    from = config.fromAddr || config.username;
  } else {
    const row = await db.mailConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (!row || !row.host) {
      return { ok: false, error: "Keine SMTP-Konfiguration in der Datenbank vorhanden." };
    }
    host = row.host;
    port = row.port;
    user = row.username;
    pass = row.password;
    from = row.fromAddr || row.username;
  }

  if (!host) {
    return { ok: false, error: "SMTP-Host fehlt." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to,
      subject: "Testmail — 420er Rangliste",
      text:
        "Diese Test-Mail bestätigt, dass die SMTP-Konfiguration funktioniert.\n\n" +
        "Wenn Sie diese E-Mail erhalten, ist der Versand vollständig eingerichtet.\n\n" +
        "(Automatisch von /admin/mail versendet.)",
    });
    return { ok: true, data: { to } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
