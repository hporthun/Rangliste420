"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, Fingerprint, ArrowLeft, Eye, EyeOff, Globe } from "lucide-react";
import type { OAuthProviderInfo } from "@/lib/auth-providers";

// ── Login form ─────────────────────────────────────────────────────────────────

type Step = "credentials" | "totp";

type Props = {
  /** OAuth providers configured via env vars; rendered as buttons. */
  oauthProviders: OAuthProviderInfo[];
};

export function LoginForm({ oauthProviders }: Props) {
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

  // Surface NextAuth callback errors (e.g. signIn callback rejected the
  // OAuth attempt because no admin matches the email)
  const callbackError = params.get("error");

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
      const credential = await startAuthentication({ optionsJSON: options });

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

  // ── OAuth ──────────────────────────────────────────────────────────────────

  function handleOAuth(providerId: string) {
    // NextAuth handles the full redirect cycle; we just kick it off.
    signIn(providerId, { callbackUrl });
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

        {(error || callbackError) && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error
              ?? (callbackError === "AccessDenied"
                ? "Diese E-Mail ist keinem Admin-Konto zugeordnet."
                : "Anmeldung fehlgeschlagen.")}
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

      {/* OAuth buttons (only configured providers) */}
      {oauthProviders.length > 0 && (
        <div className="space-y-2">
          {oauthProviders.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleOAuth(p.id)}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <ProviderIcon id={p.id} />
              Mit {p.name} anmelden
            </button>
          ))}
        </div>
      )}

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

// ── Brand icons ────────────────────────────────────────────────────────────────

/**
 * Inline SVG icons for the four supported OAuth providers. Brand-accurate
 * single-glyph marks; sized 16px for the button row.
 */
function ProviderIcon({ id }: { id: string }) {
  const cls = "h-4 w-4";
  switch (id) {
    case "google":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.17v2.84A11 11 0 0 0 12 23z"/>
          <path fill="#FBBC05" d="M5.85 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.11V7.05H2.17A11 11 0 0 0 1 12c0 1.78.43 3.46 1.17 4.95l3.68-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.05L5.85 9.9C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
      );
    case "microsoft-entra-id":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="#F25022" d="M2 2h9.5v9.5H2z"/>
          <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/>
          <path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/>
          <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/>
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="currentColor" d="M16.37 13.06c-.02-2.18 1.78-3.23 1.86-3.28-1.01-1.48-2.59-1.69-3.16-1.71-1.34-.14-2.62.79-3.31.79-.69 0-1.74-.77-2.86-.75-1.47.02-2.83.86-3.59 2.18-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.74 2.19 1.1-.04 1.51-.71 2.84-.71s1.7.71 2.86.69c1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.31-.88-2.33-3.52zM14.41 6.83c.61-.74 1.02-1.77.91-2.79-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.92 2.7.98.07 1.97-.5 2.58-1.23z"/>
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.23 2.69.23v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
        </svg>
      );
    default:
      return null;
  }
}
