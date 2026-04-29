/**
 * Login page (server component).
 *
 * Computes the list of configured OAuth providers on the server (so we
 * never expose the env-var detection to the client) and passes it to the
 * client-side LoginForm.
 */
import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { getEnabledOAuthProviders } from "@/lib/auth-providers";

/**
 * Force per-request rendering. Without this, Next.js may statically
 * prerender the login page at build time and capture an empty OAuth list;
 * env vars added later in the Vercel dashboard would not show up until the
 * next deploy. (Issue #33)
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const oauthProviders = getEnabledOAuthProviders();

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
            <LoginForm oauthProviders={oauthProviders} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
