"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, Fingerprint, ArrowLeft, Eye, EyeOff, Globe } from "lucide-react";

// ── Login form ─────────────────────────────────────────────────────────────────

type Step = "credentials" | "totp";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const callbackUrl = params.get("callbackUrl") ?? "/admin";

  // ── Step 1: verify credentials via pre-check ──────────────────────────────

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pre-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!res.ok) {
        setError("Ungültiger Benutzername oder Passwort.");
        return;
      }

      const data: { needsTotp: boolean } = await res.json();

      if (data.needsTotp) {
        setStep("totp");
      } else {
        await doSignIn("");
      }
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: TOTP ───────────────────────────────────────────────────────────

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await doSignIn(totpCode);
    } finally {
      setLoading(false);
    }
  }

  // ── Shared signIn ──────────────────────────────────────────────────────────

  async function doSignIn(totpCodeValue: string) {
    const result = await signIn("credentials", {
      identifier,
      password,
      totpCode: totpCodeValue,
      redirect: false,
    });

    if (result?.error) {
      if (step === "totp") {
        setError("Ungültiger Code. Bitte erneut versuchen.");
      } else {
        setError("Anmeldung fehlgeschlagen.");
      }
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  // ── Passkey ────────────────────────────────────────────────────────────────

  async function handlePasskeyLogin() {
    setPasskeyLoading(true);
    setError(null);
    try {
      // Get challenge
      const startRes = await fetch("/api/webauthn/authenticate-start");
      if (!startRes.ok) throw new Error("Challenge konnte nicht abgerufen werden.");
      const options = await startRes.json();

      // Browser WebAuthn ceremony
      const credential = await startAuthentication(options);

      // Verify on server
      const completeRes = await fetch("/api/webauthn/authenticate-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!completeRes.ok) throw new Error("Passkey-Verifizierung fehlgeschlagen.");
      const { passkeyToken } = await completeRes.json();

      // Use token to create NextAuth session
      const result = await signIn("credentials", {
        identifier: "__passkey__",
        password: "",
        passkeyToken,
        redirect: false,
      });

      if (result?.error) throw new Error("Sitzung konnte nicht erstellt werden.");

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey-Authentifizierung abgebrochen.");
      } else {
        setError(err instanceof Error ? err.message : "Passkey-Fehler.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  // ── Render step 2: TOTP ────────────────────────────────────────────────────

  if (step === "totp") {
    return (
      <form onSubmit={handleTotpSubmit} className="space-y-5">
        <button
          type="button"
          onClick={() => { setStep("credentials"); setError(null); setTotpCode(""); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück
        </button>

        <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground text-center">
          Angemeldet als <span className="font-medium text-foreground">{identifier}</span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="totp">
            Authenticator-Code
          </label>
          <input
            id="totp"
            type="text"
            inputMode="numeric"
            pattern="[0-9\s]*"
            maxLength={8}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            autoFocus
            autoComplete="one-time-code"
            className="input text-center tracking-widest text-lg"
            placeholder="000 000"
          />
          <p className="text-xs text-muted-foreground text-center">
            Code aus der Authenticator-App oder einen Backup-Code eingeben.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || totpCode.length < 4}
          className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
        >
          {loading ? "Prüfe…" : "Bestätigen"}
        </button>
      </form>
    );
  }

  // ── Render step 1: credentials ─────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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

        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="password">
            Passwort
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="input pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-md bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm flex items-center justify-center gap-2"
        >
          <KeyRound className="h-4 w-4" />
          {loading ? "Prüfe…" : "Anmelden"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">oder</span>
        </div>
      </div>

      {/* Passkey button */}
      <button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={passkeyLoading}
        className="w-full py-2.5 px-4 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <Fingerprint className="h-4 w-4" />
        {passkeyLoading ? "Warte auf Passkey…" : "Mit Passkey anmelden"}
      </button>

      <div className="flex items-center justify-between">
        <Link
          href="/auth/forgot"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Passwort vergessen?
        </Link>
        <Link
          href="/rangliste"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Globe className="h-3 w-3" />
          Zur Rangliste
        </Link>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.175 0.095 248) 0%, oklch(0.225 0.085 240) 60%, oklch(0.28 0.08 230) 100%)",
      }}
    >
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "oklch(0.525 0.145 215)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: "oklch(0.525 0.145 215)" }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm">
        <div
          className="h-1 rounded-t-xl"
          style={{ background: "oklch(0.525 0.145 215)" }}
        />
        <div className="bg-card rounded-b-xl shadow-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <Image
                src="/logo-420.png"
                alt="420er Klasse"
                width={1000}
                height={665}
                className="h-16 w-auto rounded-md shadow-sm"
                priority
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight">420er Rangliste</h1>
            <p className="text-sm text-muted-foreground">
              DSV-Ranglistensystem · Admin-Bereich
            </p>
          </div>

          <hr className="border-border" />

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
