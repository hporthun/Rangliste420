/**
 * OAuth-provider configuration helper.
 *
 * Each provider is enabled only when its env vars are set, so a Vercel
 * deployment without OAuth credentials still boots correctly. The list is
 * also exposed to the login page so we render only buttons for actually
 * configured providers.
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

const ALL_INFO: Record<OAuthProviderId, OAuthProviderInfo> = {
  "google":             { id: "google",             name: "Google"    },
  "microsoft-entra-id": { id: "microsoft-entra-id", name: "Microsoft" },
  "apple":              { id: "apple",              name: "Apple"     },
  "facebook":           { id: "facebook",           name: "Meta"      },
};

/**
 * Build the list of NextAuth provider instances based on which env vars are
 * present. Order matters for the UI (most common first).
 */
export function buildOAuthProviders(): Provider[] {
  const list: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  if (
    process.env.MICROSOFT_ENTRA_ID_CLIENT_ID &&
    process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET
  ) {
    list.push(
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
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    list.push(
      Apple({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
      })
    );
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    list.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    );
  }

  return list;
}

/**
 * Returns the configured OAuth providers as a UI-friendly list, in the order
 * we want the buttons to appear. Server-only; do not import from a Client
 * Component.
 */
export function getEnabledOAuthProviders(): OAuthProviderInfo[] {
  return buildOAuthProviders().map((p) => {
    // NextAuth provider instances expose `id` for both function-style and
    // object-style configs; we rely on that to look up our info table.
    const id = ((p as unknown as { id?: string }).id ?? "") as OAuthProviderId;
    return ALL_INFO[id];
  }).filter((info): info is OAuthProviderInfo => Boolean(info));
}
