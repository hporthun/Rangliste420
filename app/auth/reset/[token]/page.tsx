"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/account";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setLoading(true);
    const result = await resetPasswordAction(token, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
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
            <h1 className="text-xl font-bold tracking-tight">Neues Passwort</h1>
            <p className="text-sm text-muted-foreground">420er Rangliste · Admin-Bereich</p>
          </div>

          <hr className="border-border" />

          {done ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div>
                  <p className="font-semibold">Passwort geändert</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Das neue Passwort ist sofort aktiv.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 transition-opacity shadow-sm"
              >
                Zur Anmeldung
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="pw1">
                  Neues Passwort
                </label>
                <div className="relative">
                  <input
                    id="pw1"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input pr-10"
                    placeholder="Mindestens 8 Zeichen"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="pw2">
                  Passwort bestätigen
                </label>
                <input
                  id="pw2"
                  type={showPw ? "text" : "password"}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="input"
                  placeholder="Wiederholen"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {loading ? "Speichern…" : "Passwort ändern"}
              </button>
            </form>
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
