"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MailCheck, AlertTriangle } from "lucide-react";
import { generateResetTokenAction } from "@/lib/actions/account";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [transportConfigured, setTransportConfigured] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await generateResetTokenAction(identifier.trim());

    setLoading(false);
    setSubmitted(true);
    if (result.ok) {
      setTransportConfigured(result.data.transportConfigured);
    }
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
                Falls ein Account mit dieser E-Mail oder diesem Benutzernamen
                existiert, wird ein Link zum Zurücksetzen des Passworts an die
                hinterlegte E-Mail-Adresse versendet.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {loading ? "Wird versendet…" : "Reset-Link versenden"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-start gap-3">
                <MailCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    Anfrage angenommen
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Falls ein Account mit dieser Eingabe existiert und eine
                    E-Mail hinterlegt ist, wurde ein Link zum Zurücksetzen
                    versendet. Der Link ist 60 Minuten gültig und kann nur einmal
                    verwendet werden.
                  </p>
                </div>
              </div>

              {!transportConfigured && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      E-Mail-Versand nicht konfiguriert
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Auf dem Server ist kein SMTP-Transport eingerichtet —
                      es wurde keine Mail tatsächlich versendet. Bitte
                      Administrator kontaktieren oder die Server-Logs prüfen
                      (der Reset-Link wird dort als Fallback geloggt).
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setSubmitted(false); setIdentifier(""); }}
                className="w-full py-2 text-sm rounded-md border hover:bg-muted transition-colors"
              >
                Erneut versuchen
              </button>
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
