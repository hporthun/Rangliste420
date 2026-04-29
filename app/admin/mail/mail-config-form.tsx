"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Save, Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  saveMailConfigAction,
  testMailConfigAction,
  type MailConfig,
} from "@/lib/actions/mail-config";

type FormState = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  /** Empty string means "keep stored password". */
  password: string;
  fromAddr: string;
};

export function MailConfigForm({ initial }: { initial: MailConfig }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    enabled: initial.enabled,
    host: initial.host,
    port: initial.port,
    username: initial.username,
    password: "",
    fromAddr: initial.fromAddr,
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [saveResult, setSaveResult] = useState<"ok" | string | null>(null);
  const [testResult, setTestResult] = useState<"idle" | { ok: true; to: string } | { ok: false; error: string }>("idle");
  const [testTo, setTestTo] = useState("");

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveResult(null);
    setTestResult("idle");
  }

  function handleSave() {
    setSaveResult(null);
    startSave(async () => {
      const res = await saveMailConfigAction({
        enabled: form.enabled,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        fromAddr: form.fromAddr,
      });
      if (res.ok) {
        setSaveResult("ok");
        // Clear the password input so subsequent edits don't re-submit it.
        setForm((p) => ({ ...p, password: "" }));
        router.refresh();
      } else {
        setSaveResult(res.error);
      }
    });
  }

  function handleTest() {
    setTestResult("idle");
    startTest(async () => {
      const res = await testMailConfigAction({
        to: testTo,
        config: {
          enabled: form.enabled,
          host: form.host,
          port: form.port,
          username: form.username,
          password: form.password,
          fromAddr: form.fromAddr,
        },
      });
      if (res.ok) setTestResult({ ok: true, to: res.data.to });
      else setTestResult({ ok: false, error: res.error });
    });
  }

  return (
    <div className="space-y-4 rounded-md border p-4 bg-card">
      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => patch("enabled", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm font-medium">SMTP-Konfiguration aktivieren</span>
      </label>
      <p className="text-xs text-muted-foreground -mt-2">
        Wenn aktiv: Diese Werte werden für alle System-Mails benutzt
        (Passwort-Reset usw.). Wenn inaktiv: Fallback auf Env-Vars.
      </p>

      <hr className="border-border" />

      {/* Host + port */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Host</label>
          <input
            type="text"
            value={form.host}
            onChange={(e) => patch("host", e.target.value)}
            placeholder="smtp.strato.de"
            autoComplete="off"
            className="input text-sm w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Port</label>
          <input
            type="number"
            min={1}
            max={65535}
            value={form.port}
            onChange={(e) => patch("port", parseInt(e.target.value, 10) || 0)}
            className="input text-sm w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            587 = STARTTLS · 465 = SSL/TLS
          </p>
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase">Benutzername</label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => patch("username", e.target.value)}
          placeholder="login@meine-domain.de"
          autoComplete="off"
          className="input text-sm w-full"
        />
      </div>

      {/* Password */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase">Passwort</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={(e) => patch("password", e.target.value)}
            placeholder={
              initial.hasPassword
                ? "Passwort gesetzt — leer lassen, um es beizubehalten"
                : "Passwort eingeben"
            }
            autoComplete="new-password"
            className="input text-sm w-full pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* From address */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase">Absender</label>
        <input
          type="text"
          value={form.fromAddr}
          onChange={(e) => patch("fromAddr", e.target.value)}
          placeholder='"420er Rangliste" <noreply@meine-domain.de>'
          autoComplete="off"
          className="input text-sm w-full"
        />
        <p className="text-[11px] text-muted-foreground">
          Optional. Leer = es wird der Benutzername als Absender verwendet.
        </p>
      </div>

      {/* Save button + result */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 font-medium"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </button>
        {saveResult === "ok" && (
          <span className="flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </span>
        )}
        {saveResult && saveResult !== "ok" && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <XCircle className="h-4 w-4" /> {saveResult}
          </span>
        )}
      </div>

      <hr className="border-border" />

      {/* Test mail */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Test-Mail versenden</p>
        <p className="text-xs text-muted-foreground">
          Schickt sofort eine Test-Mail mit den oben eingetragenen Werten —
          auch ohne vorher zu speichern. So lässt sich vor dem Speichern
          prüfen, ob Host, Port und Login funktionieren.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="empfaenger@beispiel.de"
            className="input text-sm flex-1"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testTo || !form.host}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Test senden
          </button>
        </div>
        {testResult !== "idle" && testResult.ok && (
          <p className="flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Test-Mail an {testResult.to} versendet.
          </p>
        )}
        {testResult !== "idle" && !testResult.ok && (
          <p className="flex items-start gap-1 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="break-all">{testResult.error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
