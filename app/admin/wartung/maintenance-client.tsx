"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  deleteAllDataAction,
  restoreBackupAction,
  pruneOldDataAction,
  pruneOrphanSailorsAction,
  pruneOrphanTeamEntriesAction,
  pruneEmptyRankingsAction,
  type PruneResult,
} from "@/lib/actions/maintenance";
import { triggerBackupNowAction } from "@/lib/actions/backup-schedule";

// ── Restore section ────────────────────────────────────────────────────────────

export function RestoreSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success"; restored: Record<string, number> }
    | { type: "error"; message: string }
  >({ type: "idle" });

  async function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setIsEncrypted(false); return; }
    // Peek first 30 chars to detect encryption
    const head = await file.slice(0, 30).text();
    setIsEncrypted(head.includes('"encrypted": true') || head.includes('"encrypted":true'));
    setStatus({ type: "idle" });
  }

  async function handleRestore() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus({ type: "error", message: "Bitte eine Backup-Datei auswählen." });
      return;
    }
    if (isEncrypted && !password) {
      setStatus({ type: "error", message: "Bitte das Entschlüsselungs-Passwort eingeben." });
      return;
    }
    setStatus({ type: "loading" });
    try {
      const fd = new FormData();
      fd.append("backup", file);
      if (isEncrypted && password) fd.append("password", password);
      const result = await restoreBackupAction(fd);
      if (!result.ok) {
        setStatus({ type: "error", message: result.error });
      } else {
        setStatus({ type: "success", restored: result.restored });
        if (fileRef.current) fileRef.current.value = "";
        setIsEncrypted(false);
        setPassword("");
      }
    } catch (e) {
      setStatus({ type: "error", message: String(e) });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Backup-Datei (.json)</label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-sm file:bg-white file:hover:bg-gray-50 file:cursor-pointer"
        />
      </div>

      {isEncrypted && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            Backup ist verschlüsselt — Passwort eingeben
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entschlüsselungs-Passwort"
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
        </div>
      )}

      {status.type === "error" && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {status.message}
        </p>
      )}
      {status.type === "success" && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2 space-y-1">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Rücksicherung erfolgreich.
          </p>
          <ul className="ml-6 list-disc text-xs text-green-700">
            {Object.entries(status.restored).map(([key, count]) => (
              <li key={key}>
                {key}: {count}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleRestore}
        disabled={status.type === "loading"}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {status.type === "loading" ? "Wird wiederhergestellt…" : "Jetzt rücksichern"}
      </button>
      <p className="text-xs text-muted-foreground">
        Achtung: Alle vorhandenen Daten werden vor der Rücksicherung gelöscht.
      </p>
    </div>
  );
}

// ── Delete-all section ─────────────────────────────────────────────────────────

export function DeleteAllSection() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm1" | "confirm2" | "backing-up" | "loading" | "done">("idle");
  const [doBackup, setDoBackup] = useState(true);
  const [deleted, setDeleted] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);

    if (doBackup) {
      setStep("backing-up");
      const backupRes = await triggerBackupNowAction();
      if (!backupRes.ok) {
        setError(`Backup fehlgeschlagen: ${backupRes.error}`);
        setStep("confirm2");
        return;
      }
      router.refresh(); // Backup-Liste aktualisieren
    }

    setStep("loading");
    const result = await deleteAllDataAction();
    if (!result.ok) {
      setError(result.error);
      setStep("confirm2");
      return;
    }
    setDeleted(result.deleted);
    setStep("done");
  }

  if (step === "done" && deleted) {
    return (
      <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2 space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Alle Daten wurden gelöscht.
        </p>
        <ul className="ml-6 list-disc text-xs text-green-700">
          {Object.entries(deleted).map(([key, count]) => (
            <li key={key}>
              {key}: {count} gelöscht
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Backup-before checkbox — always visible */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={doBackup}
          onChange={(e) => setDoBackup(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm">Vor dem Löschen Backup anlegen</span>
      </label>

      {step === "idle" && (
        <button
          onClick={() => setStep("confirm1")}
          className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 font-medium"
        >
          Alle Daten löschen…
        </button>
      )}

      {step === "confirm1" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Alle Segler, Regatten und Ergebnisse werden unwiderruflich gelöscht. Admin-Accounts bleiben erhalten.
            {doBackup && " Vorher wird automatisch ein Backup erstellt."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("idle")}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={() => setStep("confirm2")}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium"
            >
              Ja, ich bin sicher
            </button>
          </div>
        </div>
      )}

      {(step === "confirm2" || step === "backing-up" || step === "loading") && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Letzte Bestätigung: Diese Aktion kann nicht rückgängig gemacht werden!
            {doBackup && " Vorher wird ein Backup auf dem Server gespeichert."}
          </p>
          {error && (
            <p className="text-xs text-red-700 bg-white border border-red-200 rounded px-2 py-1">
              Fehler: {error}
            </p>
          )}
          {step === "backing-up" && (
            <p className="flex items-center gap-2 text-sm text-amber-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Backup wird erstellt…
            </p>
          )}
          {step === "loading" && (
            <p className="flex items-center gap-2 text-sm text-red-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Daten werden gelöscht…
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setStep("idle"); setError(null); }}
              disabled={step === "backing-up" || step === "loading"}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={step === "backing-up" || step === "loading"}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              Endgültig alles löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic simple-cleanup row ─────────────────────────────────────────────────

type CleanupRowState =
  | { type: "idle" }
  | { type: "confirm" }
  | { type: "loading" }
  | { type: "success"; deleted: number }
  | { type: "error"; message: string };

function CleanupRow({
  label,
  description,
  confirmText,
  onRun,
}: {
  label: string;
  description: string;
  confirmText: string;
  onRun: () => Promise<{ ok: true; deleted: number } | { ok: false; error: string }>;
}) {
  const [state, setState] = useState<CleanupRowState>({ type: "idle" });

  async function run() {
    setState({ type: "loading" });
    const res = await onRun();
    if (res.ok) setState({ type: "success", deleted: res.deleted });
    else setState({ type: "error", message: res.error });
  }

  return (
    <div className="space-y-2">
      {/* Label + action button row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {state.type === "idle" && (
          <button
            type="button"
            onClick={() => setState({ type: "confirm" })}
            className="shrink-0 px-3 py-1.5 text-xs border border-amber-400 text-amber-800 rounded-md hover:bg-amber-50 font-medium"
          >
            Bereinigen…
          </button>
        )}
        {state.type === "loading" && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Wird gelöscht…
          </span>
        )}
        {state.type === "success" && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {state.deleted === 0 ? "Nichts zu löschen" : `${state.deleted} gelöscht`}
          </span>
        )}
      </div>

      {/* Confirm dialog */}
      {state.type === "confirm" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 space-y-2">
          <p className="flex items-start gap-2 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {confirmText}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setState({ type: "idle" })}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={run}
              className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium"
            >
              Jetzt löschen
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {state.type === "error" && (
        <p className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}

// ── Cleanup section (orphan / empty records) ───────────────────────────────────

export function CleanupSection() {
  return (
    <div className="space-y-5 divide-y">
      <CleanupRow
        label="Segler ohne Einträge löschen"
        description="Segler, die weder als Steuermann noch als Crew in einer Regatta eingetragen sind."
        confirmText="Alle Segler ohne Regatta-Eintrag werden unwiderruflich gelöscht."
        onRun={pruneOrphanSailorsAction}
      />
      <div className="pt-5">
        <CleanupRow
          label="Teams ohne Ergebnisse löschen"
          description="TeamEntries ohne zugehörige Ergebnisdatensätze (z.B. aus abgebrochenen Importen)."
          confirmText="Alle TeamEntries ohne Ergebnisse werden unwiderruflich gelöscht."
          onRun={pruneOrphanTeamEntriesAction}
        />
      </div>
      <div className="pt-5">
        <CleanupRow
          label="Ranglisten ohne Regatten löschen"
          description="Ranglisten, denen noch keine Regatta zugeordnet wurde."
          confirmText="Alle Ranglisten ohne Regatta-Verknüpfung werden unwiderruflich gelöscht."
          onRun={pruneEmptyRankingsAction}
        />
      </div>
    </div>
  );
}

// ── Prune section ──────────────────────────────────────────────────────────────

export function PruneSection({ regattaYears }: { regattaYears: number[] }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [beforeYear, setBeforeYear] = useState(String(currentYear));
  const [doBackup, setDoBackup] = useState(true);
  const [step, setStep] = useState<"idle" | "confirm" | "backing-up" | "loading">("idle");
  const [result, setResult] = useState<PruneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // All distinct regatta years + current year as upper bound
  const yearOptions = Array.from(new Set([...regattaYears, currentYear])).sort((a, b) => a - b);

  async function handlePrune() {
    setError(null);

    if (doBackup) {
      setStep("backing-up");
      const backupRes = await triggerBackupNowAction();
      if (!backupRes.ok) {
        setError(`Backup fehlgeschlagen: ${backupRes.error}`);
        setStep("confirm");
        return;
      }
      router.refresh(); // Backup-Liste aktualisieren
    }

    setStep("loading");
    const res = await pruneOldDataAction(Number(beforeYear));
    if (!res.ok) {
      setError(res.error);
      setStep("confirm");
      return;
    }
    setResult(res.deleted);
    setStep("idle");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Regatten löschen vor Jahr
          </label>
          <select
            value={beforeYear}
            onChange={(e) => {
              setBeforeYear(e.target.value);
              setStep("idle");
              setResult(null);
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                vor {y} (d.h. bis {y - 1})
              </option>
            ))}
          </select>
        </div>

        {step === "idle" && (
          <button
            onClick={() => setStep("confirm")}
            className="px-4 py-2 text-sm border border-amber-400 text-amber-800 rounded-md hover:bg-amber-50 font-medium"
          >
            Reduzieren…
          </button>
        )}
      </div>

      {/* Backup-before checkbox — always visible */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={doBackup}
          onChange={(e) => setDoBackup(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm">Vor dem Löschen Backup durchführen</span>
      </label>

      {step === "confirm" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Alle Regatten vor {beforeYear} werden unwiderruflich gelöscht, inkl. aller Ergebnisse.
            Danach werden alle Segler ohne verbleibende Einträge ebenfalls gelöscht.
            {doBackup && " Vorher wird automatisch ein Backup erstellt."}
          </p>
          {error && (
            <p className="text-xs text-red-700 bg-white border border-red-200 rounded px-2 py-1">
              Fehler: {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setStep("idle"); setError(null); }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handlePrune}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium"
            >
              Jetzt löschen
            </button>
          </div>
        </div>
      )}

      {step === "backing-up" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Backup wird erstellt…
        </p>
      )}

      {step === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird gelöscht…
        </p>
      )}

      {result && step === "idle" && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2 space-y-1">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Datenreduktion abgeschlossen.
          </p>
          <ul className="ml-6 list-disc text-xs text-green-700">
            <li>Regatten gelöscht: {result.regattas}</li>
            <li>Import-Sessions gelöscht: {result.importSessions}</li>
            <li>Ranglisten-Verknüpfungen gelöscht: {result.rankingRegattas}</li>
            <li>Segler ohne Einträge gelöscht: {result.orphanedSailors}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
