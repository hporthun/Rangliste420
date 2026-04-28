"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type AuditLogEntry = {
  id: string;
  userId: string | null;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: Date;
};

type UserInfo = { id: string; username: string | null; email: string | null };

// ── Badge color per action group ───────────────────────────────────────────────

const ACTION_STYLES: Record<string, string> = {
  LOGIN_SUCCESS:   "bg-green-100 text-green-800",
  LOGIN_PASSKEY:   "bg-green-100 text-green-800",
  LOGIN_FAILED:    "bg-red-100 text-red-800",
  LOGIN_LOCKED:    "bg-red-200 text-red-900",
  LOGOUT:          "bg-slate-100 text-slate-700",
  RESET_TOKEN:     "bg-yellow-100 text-yellow-800",
  PASSWORD_RESET:  "bg-yellow-100 text-yellow-800",
  USERNAME_CHANGE: "bg-blue-100 text-blue-800",
  EMAIL_CHANGE:    "bg-blue-100 text-blue-800",
  PASSWORD_CHANGE: "bg-blue-100 text-blue-800",
  TOTP_ENABLED:    "bg-purple-100 text-purple-800",
  TOTP_DISABLED:   "bg-purple-100 text-purple-800",
  PASSKEY_ADDED:   "bg-purple-100 text-purple-800",
  PASSKEY_REMOVED: "bg-purple-100 text-purple-800",
  DATA_DELETE_ALL: "bg-red-200 text-red-900",
  DATA_PRUNE:      "bg-orange-100 text-orange-800",
  BACKUP_CREATED:  "bg-teal-100 text-teal-800",
  BACKUP_RESTORED: "bg-orange-100 text-orange-800",
  BACKUP_DELETED:  "bg-orange-100 text-orange-800",
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS:   "Login ✓",
  LOGIN_PASSKEY:   "Passkey-Login ✓",
  LOGIN_FAILED:    "Login fehlgeschlagen",
  LOGIN_LOCKED:    "Account gesperrt",
  LOGOUT:          "Abgemeldet",
  RESET_TOKEN:     "Reset-Token generiert",
  PASSWORD_RESET:  "Passwort zurückgesetzt",
  USERNAME_CHANGE: "Benutzername geändert",
  EMAIL_CHANGE:    "E-Mail geändert",
  PASSWORD_CHANGE: "Passwort geändert",
  TOTP_ENABLED:    "2FA aktiviert",
  TOTP_DISABLED:   "2FA deaktiviert",
  PASSKEY_ADDED:   "Passkey hinzugefügt",
  PASSKEY_REMOVED: "Passkey entfernt",
  DATA_DELETE_ALL: "Alle Daten gelöscht",
  DATA_PRUNE:      "Daten bereinigt",
  BACKUP_CREATED:  "Backup erstellt",
  BACKUP_RESTORED: "Backup wiederhergestellt",
  BACKUP_DELETED:  "Backup gelöscht",
};

const PREVIEW_COUNT = 5;

// ── Sub-component: single log row ─────────────────────────────────────────────

function LogRow({ log, userMap }: { log: AuditLogEntry; userMap: Record<string, UserInfo> }) {
  const style = ACTION_STYLES[log.action] ?? "bg-slate-100 text-slate-700";
  const label = ACTION_LABELS[log.action] ?? log.action;
  const ts = log.createdAt.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const u = log.userId ? userMap[log.userId] : null;
  const actor = u?.username ?? u?.email ?? (log.userId ? log.userId.slice(0, 8) + "…" : "–");

  return (
    <tr className="even:bg-muted/20 align-top">
      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground font-mono text-xs">{ts}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", style)}>
          {label}
        </span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{actor}</td>
      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell max-w-xs truncate">
        {log.detail ?? "–"}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell">
        {log.ip ?? "–"}
      </td>
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditLogSection({
  logs,
  userMap,
}: {
  logs: AuditLogEntry[];
  userMap: Record<string, UserInfo>;
}) {
  const [showAll, setShowAll] = useState(false);

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Noch keine Einträge vorhanden.</p>
    );
  }

  const preview = logs.slice(0, PREVIEW_COUNT);
  const rest = logs.slice(PREVIEW_COUNT);
  const visible = showAll ? logs : preview;

  return (
    <div className="rounded-md border overflow-x-auto text-sm">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="bg-muted/50 text-left text-xs text-muted-foreground border-b">
            <th className="px-3 py-2 font-medium">Zeitpunkt</th>
            <th className="px-3 py-2 font-medium">Ereignis</th>
            <th className="px-3 py-2 font-medium">Benutzer</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Detail</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {visible.map((log) => (
            <LogRow key={log.id} log={log} userMap={userMap} />
          ))}
        </tbody>
      </table>

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-t text-left"
        >
          {showAll
            ? "▲ Weniger anzeigen"
            : `▼ ${rest.length} weitere Einträge anzeigen`}
        </button>
      )}
    </div>
  );
}
