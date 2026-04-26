"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { generateResetTokenAction } from "@/lib/actions/account";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await generateResetTokenAction(identifier.trim());

    setLoading(false);
    setSubmitted(true);

    if (result.ok && result.data.token) {
      const url = `${window.location.origin}/auth/reset/${result.data.token}`;
      setResetUrl(url);
    }
  }

  async function handleCopy() {
    if (!resetUrl) return;
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.175 0.095 248) 0%, oklch(0.225 0.085 240) 60%, oklch(0.28 0.08 230) 100%)",
      }}
    >
      <div className="relative w-full max-w-sm">
        <div className="h-1 rounded-t-xl" style={{ background: "oklch(0.525 0.145 215)" }} />
        <div className="bg-card rounded-b-xl shadow-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <Image src="/logo-420.png" alt="420er Klasse" width={1000} height={665} className="h-16 w-auto rounded-md shadow-sm" priority />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Passwort zurücksetzen</h1>
            <p className="text-sm text-muted-foreground">420er Rangliste · Admin-Bereich</p>
          </div>

          <hr className="border-border" />

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="identifier">
                  Benutzername oder E-Mail
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="input"
                  placeholder="admin"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Falls der Account existiert, wird ein Reset-Link generiert und direkt angezeigt (kein E-Mail-Versand).
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {loading ? "Prüfe…" : "Reset-Link generieren"}
              </button>
            </form>
          ) : resetUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                  Reset-Link erstellt
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Gültig für 1 Stunde. Der Link kann nur einmal verwendet werden.
                </p>
              </div>

              <div className="rounded-md border bg-muted/50 p-3 break-all text-xs font-mono text-muted-foreground">
                {resetUrl}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Kopiert!" : "Kopieren"}
                </button>
                <Link
                  href={resetUrl}
                  className="flex-1 flex items-center justify-center py-2 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 transition-opacity text-center"
                >
                  Link öffnen
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 border px-4 py-4 text-sm text-muted-foreground text-center">
              Falls ein Account mit diesem Namen oder dieser E-Mail existiert, wurde ein Reset-Link erstellt. Bitte erneut versuchen oder den Administrator kontaktieren.
            </div>
          )}

          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zur Anmeldung
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
