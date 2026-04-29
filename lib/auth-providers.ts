/**
 * OAuth-provider configuration helper.
 *
 * Each provider is enabled only when its env vars are set, so a Vercel
 * deployment without OAuth credentials still boots correctly. The list is
 * also exposed to the login page so we render only buttons for actually
 * configured providers.
 *
 * Issue #33: previous implementation extracted the provider `id` at runtime
 * via `(p as { id?: string }).id`, which was fragile because Auth.js v5
 * providers can return either a config object or a lazy function — in the
 * function case `id` is undefined and the button silently disappeared from
 * the login screen even though env vars were set. We now build providers
 * and the UI metadata together in a single pass so the lookup is no longer
 * runtime-dependent.
 */
import type { Provider } from "next-auth/providers";

import Google           from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple            from "next-auth/providers/apple";
import Facebook         from "next-auth/providers/facebook";

export type OAuthProviderId = "google" | "microsoft-entra-id" | "apple" | "facebook";

export type OAuthProviderInfo = {
  id: OAuthProviderId;
  /** Human-readable name shown on the login button. */
  name: string;
};

type Built = {
  providers: Provider[];
  info: OAuthProviderInfo[];
};

/**
 * Build providers and UI info in a single pass. Each block reads the
 * relevant env vars; when both client-id and -secret are present, the
 * provider is added AND its display info is recorded in the same step.
 * This avoids any runtime introspection of the provider object.
 */
function build(): Built {
  const providers: Provider[] = [];
  const info: OAuthProviderInfo[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
    info.push({ id: "google", name: "Google" });
  }

  if (
    process.env.MICROSOFT_ENTRA_ID_CLIENT_ID &&
    process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET
  ) {
    providers.push(
      MicrosoftEntraID({
        clientId: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET,
        // "common" lets both personal Microsoft accounts and any work/school
        // tenant sign in. Override via MICROSOFT_ENTRA_ID_TENANT_ID for
        // single-tenant setups.
        issuer: `https://login.microsoftonline.com/${
          process.env.MICROSOFT_ENTRA_ID_TENANT_ID ?? "common"
        }/v2.0`,
      })
    );
    info.push({ id: "microsoft-entra-id", name: "Microsoft" });
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push(
      Apple({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
      })
    );
    info.push({ id: "apple", name: "Apple" });
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    );
    info.push({ id: "facebook", name: "Meta" });
  }

  return { providers, info };
}

/** NextAuth provider instances. Used in lib/auth.ts to wire the providers. */
export function buildOAuthProviders(): Provider[] {
  return build().providers;
}

/**
 * UI-friendly list of configured OAuth providers — one entry per
 * `*_CLIENT_ID` + `*_CLIENT_SECRET` pair found in the environment.
 * Server-only; do not import from a Client Component.
 */
export function getEnabledOAuthProviders(): OAuthProviderInfo[] {
  return build().info;
}
