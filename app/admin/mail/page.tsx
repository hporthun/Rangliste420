/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { Mail, Info } from "lucide-react";
import { getMailConfigAction } from "@/lib/actions/mail-config";
import { getMailConfigSource } from "@/lib/mail/send";
import { MailConfigForm } from "./mail-config-form";

export default async function MailConfigPage() {
  const [cfg, source] = await Promise.all([
    getMailConfigAction(),
    getMailConfigSource(),
  ]);

  if (!cfg.ok) {
    return (
      <div className="max-w-2xl">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <p className="text-sm text-red-600 mt-4">{cfg.error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          E-Mail-Konfiguration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          SMTP-Zugangsdaten für den Versand von Passwort-Reset-Mails.
        </p>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">
            Status:{" "}
            {source === "database" && <span className="text-emerald-700">DB-Konfiguration aktiv</span>}
            {source === "env" && <span className="text-amber-700">Env-Variablen aktiv (Fallback)</span>}
            {source === null && <span className="text-red-700">Nicht konfiguriert</span>}
          </p>
          <p className="text-xs leading-relaxed">
            Diese Seite überschreibt die <code className="font-mono">SMTP_*</code>-Env-Variablen,
            sobald „Aktivieren" angehakt und ein Host eingetragen ist. So lassen sich SMTP-Zugänge
            ändern, ohne dass die App neu deployed werden muss.
          </p>
        </div>
      </div>

      <MailConfigForm initial={cfg.data} />
    </div>
  );
}
