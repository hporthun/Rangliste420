"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  User, Mail, Lock, ShieldCheck, Shield, Fingerprint, Bell,
  Eye, EyeOff, Plus, Trash2, CheckCircle2, AlertTriangle, Pencil,
} from "lucide-react";
import {
  changeUsernameAction,
  changeEmailAction,
  changePasswordAction,
  setupTotpAction,
  verifyAndEnableTotpAction,
  disableTotpAction,
  deletePasskeyAction,
  renamePasskeyAction,
} from "@/lib/actions/account";
import { PushAccountSection } from "@/components/admin/push-account-section";

// ── Types ─────────────────────────────────────────────────────────────────────

type Passkey = {
  id: string;
  name: string;
  deviceType: string;
  lastUsed: Date | null;
  createdAt: Date;
};

type Props = {
  username: string | null;
  email: string | null;
  totpEnabled: boolean;
  passkeys: Passkey[];
};

// ── Status message ─────────────────────────────────────────────────────────────

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  if (!msg) return null;
  return (
    <p
      className={`text-sm px-3 py-2 rounded-md border ${
        ok
          ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          : "text-destructive bg-destructive/10 border-destructive/20"
      }`}
    >
      {msg}
    </p>
  );
}

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── Username section ───────────────────────────────────────────────────────────

function UsernameSection({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const result = await changeUsernameAction(value);
      setOk(result.ok);
      setMsg(result.ok ? "Benutzername gespeichert." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Section icon={User} title="Benutzername">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input flex-1"
            placeholder="admin"
            autoComplete="username"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || value === initial}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {pending ? "…" : "Speichern"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          2–32 Zeichen, nur Buchstaben, Zahlen, _ und -. Wird für die Anmeldung verwendet.
        </p>
        <StatusMsg ok={ok} msg={msg} />
      </div>
    </Section>
  );
}

// ── Email section ─────────────────────────────────────────────────────────────

function EmailSection({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const result = await changeEmailAction(value);
      setOk(result.ok);
      setMsg(result.ok ? "E-Mail gespeichert." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Section icon={Mail} title="E-Mail-Adresse">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input flex-1"
            placeholder="optional"
            autoComplete="email"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || value === (initial ?? "")}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {pending ? "…" : "Speichern"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Kann auch für die Anmeldung genutzt werden. Leer lassen, um die E-Mail zu entfernen.
        </p>
        <StatusMsg ok={ok} msg={msg} />
      </div>
    </Section>
  );
}

// ── Password section ───────────────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [pending, start] = useTransition();

  function save() {
    if (next !== next2) { setOk(false); setMsg("Passwörter stimmen nicht überein."); return; }
    start(async () => {
      const result = await changePasswordAction(current, next);
      setOk(result.ok);
      setMsg(result.ok ? "Passwort geändert." : result.error);
      if (result.ok) { setCurrent(""); setNext(""); setNext2(""); }
    });
  }

  return (
    <Section icon={Lock} title="Passwort ändern">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aktuelles Passwort</label>
          <div className="relative">
            <input type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} className="input pr-10" autoComplete="current-password" placeholder="••••••••" />
            <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Neues Passwort</label>
          <input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} className="input" autoComplete="new-password" placeholder="Mindestens 8 Zeichen" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Neues Passwort bestätigen</label>
          <input type={show ? "text" : "password"} value={next2} onChange={(e) => setNext2(e.target.value)} className="input" autoComplete="new-password" placeholder="Wiederholen" />
        </div>
        <StatusMsg ok={ok} msg={msg} />
        <button type="button" onClick={save} disabled={pending || !current || !next || !next2} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
          {pending ? "Speichern…" : "Passwort ändern"}
        </button>
      </div>
    </Section>
  );
}

// ── TOTP section ───────────────────────────────────────────────────────────────

type TotpSetupState = "idle" | "setup" | "backup-codes" | "disable";

function TotpSection({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [state, setState] = useState<TotpSetupState>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [pending, start] = useTransition();

  function startSetup() {
    start(async () => {
      const result = await setupTotpAction();
      if (!result.ok) { setOk(false); setMsg(result.error); return; }
      setQrDataUrl(result.data.qrDataUrl);
      setSecret(result.data.secret);
      setCode("");
      setState("setup");
    });
  }

  function verify() {
    start(async () => {
      const result = await verifyAndEnableTotpAction(code);
      if (!result.ok) { setOk(false); setMsg(result.error); return; }
      setBackupCodes(result.data.backupCodes);
      setEnabled(true);
      setState("backup-codes");
      setMsg("");
    });
  }

  function startDisable() {
    setDisableCode("");
    setMsg("");
    setState("disable");
  }

  function disable() {
    start(async () => {
      const result = await disableTotpAction(disableCode);
      setOk(result.ok);
      setMsg(result.ok ? "" : result.error);
      if (result.ok) { setEnabled(false); setState("idle"); }
    });
  }

  if (state === "backup-codes") {
    return (
      <Section icon={ShieldCheck} title="Zwei-Faktor-Authentifizierung">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium text-sm">TOTP aktiviert!</span>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">Backup-Codes – jetzt sichern!</p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Jeder Code kann nur einmal verwendet werden. Bewahre sie sicher auf, z. B. im Passwort-Manager.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {backupCodes.map((c) => (
                <code key={c} className="text-xs font-mono bg-white dark:bg-black/30 rounded px-2 py-1 text-center border">
                  {c}
                </code>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setState("idle")} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 transition-opacity">
            Fertig
          </button>
        </div>
      </Section>
    );
  }

  if (state === "setup") {
    return (
      <Section icon={ShieldCheck} title="Zwei-Faktor-Authentifizierung einrichten">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scanne den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, Aegis, 1Password).
          </p>
          {qrDataUrl && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="TOTP QR-Code" className="rounded-lg border w-56 h-56" />
            </div>
          )}
          <div className="rounded-md bg-muted/50 border px-3 py-2">
            <p className="text-xs text-muted-foreground mb-0.5">Oder manuell eingeben:</p>
            <code className="text-xs font-mono break-all">{secret}</code>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Code bestätigen</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="input text-center tracking-widest text-lg"
              placeholder="000000"
            />
          </div>
          <StatusMsg ok={ok} msg={msg} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setState("idle")} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">
              Abbrechen
            </button>
            <button type="button" onClick={verify} disabled={pending || code.length < 6} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {pending ? "Prüfe…" : "Aktivieren"}
            </button>
          </div>
        </div>
      </Section>
    );
  }

  if (state === "disable") {
    return (
      <Section icon={Shield} title="2FA deaktivieren">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gib einen aktuellen Authenticator-Code ein, um 2FA zu deaktivieren.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            className="input text-center tracking-widest text-lg"
            placeholder="000000"
          />
          <StatusMsg ok={ok} msg={msg} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setState("idle")} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">
              Abbrechen
            </button>
            <button type="button" onClick={disable} disabled={pending || disableCode.length < 6} className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
              {pending ? "Deaktiviere…" : "2FA deaktivieren"}
            </button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section icon={enabled ? ShieldCheck : Shield} title="Zwei-Faktor-Authentifizierung (TOTP)">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          {enabled ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Aktiviert
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nicht aktiviert</p>
          )}
          <p className="text-xs text-muted-foreground">
            TOTP-Code aus einer Authenticator-App beim Login erforderlich.
          </p>
        </div>
        {enabled ? (
          <button type="button" onClick={startDisable} disabled={pending} className="px-3 py-1.5 text-sm rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap">
            Deaktivieren
          </button>
        ) : (
          <button type="button" onClick={startSetup} disabled={pending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap">
            {pending ? "…" : "Einrichten"}
          </button>
        )}
      </div>
    </Section>
  );
}

// ── Passkey section ────────────────────────────────────────────────────────────

function PasskeySection({ initialPasskeys }: { initialPasskeys: Passkey[] }) {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("Passkey");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [pending, start] = useTransition();

  async function registerPasskey() {
    setAdding(true);
    setMsg("");
    try {
      const startRes = await fetch("/api/webauthn/register-start");
      if (!startRes.ok) throw new Error("Challenge konnte nicht abgerufen werden.");
      const options = await startRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const completeRes = await fetch("/api/webauthn/register-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: credential, name: newName }),
      });
      if (!completeRes.ok) throw new Error("Registrierung fehlgeschlagen.");

      setMsgOk(true);
      setMsg(`Passkey „${newName}" erfolgreich hinzugefügt.`);
      setNewName("Passkey");
      // Reload passkeys list
      window.location.reload();
    } catch (err) {
      setMsgOk(false);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setMsg("Passkey-Registrierung abgebrochen.");
      } else {
        setMsg(err instanceof Error ? err.message : "Fehler bei der Registrierung.");
      }
    } finally {
      setAdding(false);
    }
  }

  function deletePasskey(id: string, name: string) {
    if (!confirm(`Passkey „${name}" wirklich entfernen?`)) return;
    start(async () => {
      const result = await deletePasskeyAction(id);
      if (result.ok) {
        setPasskeys((prev) => prev.filter((p) => p.id !== id));
        setMsgOk(true);
        setMsg("Passkey entfernt.");
      } else {
        setMsgOk(false);
        setMsg(result.error);
      }
    });
  }

  function startRename(p: Passkey) {
    setEditId(p.id);
    setEditName(p.name);
    setMsg("");
  }

  function saveRename(id: string) {
    start(async () => {
      const result = await renamePasskeyAction(id, editName);
      if (result.ok) {
        setPasskeys((prev) => prev.map((p) => p.id === id ? { ...p, name: editName } : p));
        setEditId(null);
        setMsgOk(true);
        setMsg("Passkey umbenannt.");
      } else {
        setMsgOk(false);
        setMsg(result.error);
      }
    });
  }

  const dateStr = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  return (
    <Section icon={Fingerprint} title="Passkeys">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Passkeys ermöglichen passwortlose Anmeldung mit Biometrie oder Hardware-Key.
        </p>

        {passkeys.length > 0 && (
          <div className="divide-y divide-border border rounded-lg overflow-hidden">
            {passkeys.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  {editId === p.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input py-1 text-sm flex-1"
                        autoFocus
                        maxLength={60}
                        onKeyDown={(e) => { if (e.key === "Enter") saveRename(p.id); if (e.key === "Escape") setEditId(null); }}
                      />
                      <button type="button" onClick={() => saveRename(p.id)} disabled={pending} className="px-3 py-1 text-xs rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50">OK</button>
                      <button type="button" onClick={() => setEditId(null)} className="px-3 py-1 text-xs rounded-md border hover:bg-muted">Abbrechen</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.deviceType === "multiDevice" ? "Sync-fähig" : "Gerätgebunden"} ·
                        Hinzugefügt {dateStr(p.createdAt)} ·
                        Zuletzt {dateStr(p.lastUsed)}
                      </p>
                    </div>
                  )}
                </div>
                {editId !== p.id && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => startRename(p)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => deletePasskey(p.id, p.name)} disabled={pending} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-36">
            <label className="text-xs font-medium text-muted-foreground">Name (optional)</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input text-sm" placeholder="z. B. iPhone, YubiKey" maxLength={60} />
          </div>
          <button
            type="button"
            onClick={registerPasskey}
            disabled={adding || pending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {adding ? "Warte auf Gerät…" : "Passkey hinzufügen"}
          </button>
        </div>

        <StatusMsg ok={msgOk} msg={msg} />
      </div>
    </Section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function KontoClient({ username, email, totpEnabled, passkeys }: Props) {
  return (
    <div className="space-y-6">
      <UsernameSection initial={username} />
      <EmailSection initial={email} />
      <PasswordSection />
      <TotpSection initialEnabled={totpEnabled} />
      <PasskeySection initialPasskeys={passkeys} />
      <Section icon={Bell} title="Push-Benachrichtigungen">
        <PushAccountSection />
      </Section>
    </div>
  );
}
