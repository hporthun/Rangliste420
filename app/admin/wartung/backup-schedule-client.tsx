"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Trash2, Download, Save, PlayCircle, Lock, Eye, EyeOff, RotateCcw, AlertTriangle } from "lucide-react";
import { saveScheduleAction, triggerBackupNowAction, deleteStoredBackupAction } from "@/lib/actions/backup-schedule";
import { restoreStoredBackupAction, type RestoreScope } from "@/lib/actions/maintenance";
import type { BackupSchedule } from "@/lib/backup/types";
import type { StoredBackup } from "@/lib/backup/writer";

const SCOPE_LABELS: Record<RestoreScope, string> = {
  all:      "Alles (vollständig)",
  sailors:  "Nur Segler",
  regattas: "Nur Regatten & Ergebnisse",
};

// ── Schedule config ────────────────────────────────────────────────────────────

const DAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function ScheduleConfig({ initial }: { initial: BackupSchedule }) {
  const [schedule, setSchedule] = useState<BackupSchedule>(initial);
  const [saving, startSave] = useTransition();
  const [saveResult, setSaveResult] = useState<"ok" | string | null>(null);
  const [showPw, setShowPw] = useState(false);

  function toggleDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b),
    }));
    setSaveResult(null);
  }

  function handleSave() {
    setSaveResult(null);
    startSave(async () => {
      const res = await saveScheduleAction(schedule);
      setSaveResult(res.ok ? "ok" : res.error);
    });
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={schedule.enabled}
          onChange={(e) => { setSchedule((p) => ({ ...p, enabled: e.target.checked })); setSaveResult(null); }}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm font-medium">Automatische Backups aktivieren</span>
      </label>

      {/* Max keep — always visible */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-muted-foreground w-32 shrink-0">
          Aufbewahrung
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={schedule.maxKeep}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) { setSchedule((p) => ({ ...p, maxKeep: v })); setSaveResult(null); }
            }}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-muted-foreground">Backups behalten</span>
        </div>
      </div>

      {schedule.enabled && (
        <>
          {/* Time picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-32 shrink-0">Uhrzeit</span>
            <select
              value={schedule.hour}
              onChange={(e) => { setSchedule((p) => ({ ...p, hour: Number(e.target.value) })); setSaveResult(null); }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{pad(h)} Uhr</option>
              ))}
            </select>
            <select
              value={schedule.minute}
              onChange={(e) => { setSchedule((p) => ({ ...p, minute: Number(e.target.value) })); setSaveResult(null); }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>:{pad(m)}</option>
              ))}
            </select>
          </div>

          {/* Day-of-week picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground w-32 shrink-0">Wochentag</span>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => {
                const active = schedule.daysOfWeek.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-9 h-9 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {schedule.daysOfWeek.length === 0 && (
              <span className="text-xs text-muted-foreground">(täglich)</span>
            )}
          </div>
        </>
      )}

      {/* Encryption password — always visible */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground w-full">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Verschlüsselung (leer = keine Verschlüsselung)
        </label>
        <div className="relative max-w-xs">
          <input
            type={showPw ? "text" : "password"}
            value={schedule.encryptionPassword}
            onChange={(e) => { setSchedule((p) => ({ ...p, encryptionPassword: e.target.value })); setSaveResult(null); }}
            placeholder="Backup-Passwort"
            autoComplete="new-password"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 pr-9 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {schedule.encryptionPassword && (
          <p className="text-xs text-amber-700 flex items-start gap-1">
            <Lock className="h-3 w-3 mt-0.5 shrink-0" />
            Das Passwort wird in der Konfigurationsdatei gespeichert. Notiere es separat —
            ohne Passwort können verschlüsselte Backups nicht wiederhergestellt werden.
          </p>
        )}
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Zeitplan speichern
        </button>
        {saveResult === "ok" && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </span>
        )}
        {saveResult && saveResult !== "ok" && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <XCircle className="h-4 w-4" /> {saveResult}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Stored backup list ─────────────────────────────────────────────────────────

type RestoreState =
  | { step: "idle" }
  | { step: "confirm";  filename: string; isEncrypted: boolean; scope: RestoreScope }
  | { step: "password"; filename: string; password: string; showPw: boolean; scope: RestoreScope }
  | { step: "loading";  filename: string }
  | { step: "success";  filename: string; restored: Record<string, number> }
  | { step: "error";    filename: string; message: string };

export function StoredBackupList({ initial }: { initial: StoredBackup[] }) {
  const router = useRouter();
  const [backups, setBackups] = useState<StoredBackup[]>(initial);
  const [triggering, startTrigger] = useTransition();
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [triggerComment, setTriggerComment] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>({ step: "idle" });

  // Sync when the server component re-renders with a fresh list
  // (e.g. after router.refresh() triggered from this or another component)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setBackups(initial); }, [initial]);

  function handleNow() {
    setTriggerMsg(null);
    startTrigger(async () => {
      const res = await triggerBackupNowAction(triggerComment || undefined);
      if (!res.ok) {
        setTriggerMsg("Fehler: " + res.error);
      } else {
        setTriggerMsg("Backup erstellt: " + res.filename);
        setTriggerComment("");
        router.refresh();
      }
    });
  }

  async function handleDelete(filename: string) {
    setDeleting(filename);
    setDeleteError(null);
    const res = await deleteStoredBackupAction(filename);
    setDeleting(null);
    if (!res.ok) {
      setDeleteError(res.error);
    } else {
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    }
  }

  function handleRestoreClick(b: StoredBackup) {
    setRestoreState(
      b.isEncrypted
        ? { step: "password", filename: b.filename, password: "", showPw: false, scope: "all" }
        : { step: "confirm",  filename: b.filename, isEncrypted: false, scope: "all" }
    );
  }

  async function handleRestoreConfirm() {
    const filename =
      restoreState.step === "confirm" || restoreState.step === "password"
        ? restoreState.filename
        : null;
    if (!filename) return;
    const password =
      restoreState.step === "password" ? restoreState.password : undefined;
    const scope: RestoreScope =
      (restoreState.step === "confirm" || restoreState.step === "password")
        ? restoreState.scope
        : "all";

    setRestoreState({ step: "loading", filename });
    const res = await restoreStoredBackupAction(filename, password, scope);
    if (!res.ok) {
      setRestoreState({ step: "error", filename, message: res.error });
    } else {
      setRestoreState({ step: "success", filename, restored: res.restored });
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-3">
      {/* Manual trigger */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 flex-wrap">
          <textarea
            value={triggerComment}
            onChange={(e) => setTriggerComment(e.target.value)}
            placeholder="Kommentar (optional) …"
            rows={2}
            className="flex-1 min-w-48 max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"
          />
          <button
            onClick={handleNow}
            disabled={triggering}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-input bg-background rounded-md hover:bg-muted disabled:opacity-50 font-medium self-start"
          >
            {triggering
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <PlayCircle className="h-4 w-4" />}
            Jetzt sichern
          </button>
        </div>
        {triggerMsg && (
          <p className="text-xs text-muted-foreground">{triggerMsg}</p>
        )}
      </div>

      {deleteError && (
        <p className="text-sm text-red-600">{deleteError}</p>
      )}

      {/* Restore confirmation / password panel */}
      {restoreState.step === "confirm" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Rücksicherung aus{" "}
            <span className="font-mono font-normal">{restoreState.filename}</span>.
            Vorher wird automatisch ein Sicherungs-Backup erstellt.
          </p>
          {/* Scope selector */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-900">Umfang:</p>
            <div className="flex flex-col gap-1">
              {(Object.keys(SCOPE_LABELS) as RestoreScope[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="stored-scope-confirm"
                    value={s}
                    checked={restoreState.scope === s}
                    onChange={() =>
                      setRestoreState((prev) =>
                        prev.step === "confirm" ? { ...prev, scope: s } : prev
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRestoreState({ step: "idle" })}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleRestoreConfirm}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium"
            >
              Jetzt rücksichern
            </button>
          </div>
        </div>
      )}

      {restoreState.step === "password" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            Backup ist verschlüsselt — Passwort eingeben, dann rücksichern.
            Vorher wird automatisch ein Sicherungs-Backup erstellt.
          </p>
          {/* Scope selector */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-900">Umfang:</p>
            <div className="flex flex-col gap-1">
              {(Object.keys(SCOPE_LABELS) as RestoreScope[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="stored-scope-password"
                    value={s}
                    checked={restoreState.scope === s}
                    onChange={() =>
                      setRestoreState((prev) =>
                        prev.step === "password" ? { ...prev, scope: s } : prev
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div className="relative max-w-xs">
            <input
              type={restoreState.showPw ? "text" : "password"}
              value={restoreState.password}
              onChange={(e) =>
                setRestoreState((prev) =>
                  prev.step === "password" ? { ...prev, password: e.target.value } : prev
                )
              }
              placeholder="Entschlüsselungs-Passwort"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 pr-9 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setRestoreState((prev) =>
                  prev.step === "password" ? { ...prev, showPw: !prev.showPw } : prev
                )
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {restoreState.showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRestoreState({ step: "idle" })}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleRestoreConfirm}
              disabled={!restoreState.password}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 font-medium"
            >
              Rücksichern
            </button>
          </div>
        </div>
      )}

      {restoreState.step === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird wiederhergestellt…
        </p>
      )}

      {restoreState.step === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 space-y-1">
          <p className="font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" /> Fehler bei der Rücksicherung
          </p>
          <p className="text-xs">{restoreState.message}</p>
          <button
            onClick={() => setRestoreState({ step: "idle" })}
            className="text-xs underline"
          >
            Schließen
          </button>
        </div>
      )}

      {restoreState.step === "success" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 space-y-1">
          <p className="font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Rücksicherung erfolgreich.
          </p>
          <ul className="ml-6 list-disc text-xs text-green-700">
            {Object.entries(restoreState.restored).map(([k, v]) => (
              <li key={k}>{k}: {v}</li>
            ))}
          </ul>
          <button
            onClick={() => setRestoreState({ step: "idle" })}
            className="text-xs underline"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Table */}
      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine gespeicherten Backups.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Dateiname</th>
                <th className="px-3 py-2 text-left">Erstellt</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Kommentar</th>
                <th className="px-3 py-2 text-right">Größe</th>
                <th className="px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {backups.map((b) => (
                <tr key={b.filename} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    <span className="flex items-center gap-1.5">
                      {b.isEncrypted && <span title="Verschlüsselt"><Lock className="h-3 w-3 text-amber-600 shrink-0" /></span>}
                      {b.filename}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDate(b.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell max-w-xs">
                    {b.comment ?? <span className="italic opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatSize(b.size)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleRestoreClick(b)}
                        disabled={restoreState.step === "loading"}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rücksichern
                      </button>
                      <a
                        href={`/api/admin/backups/${encodeURIComponent(b.filename)}`}
                        download={b.filename}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(b.filename)}
                        disabled={deleting === b.filename}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40"
                      >
                        {deleting === b.filename
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
