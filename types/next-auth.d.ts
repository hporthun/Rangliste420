import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      /** Primary login identifier shown in the UI */
      username: string;
      /**
       * tokenVersion-Snapshot aus dem JWT. Wird vom auth-guard gegen den
       * aktuellen DB-Wert geprüft, um Sessions sofort invalidieren zu können
       * (Issue #49 — „Rauswerfen", manuelle Sperrung).
       */
      tokenVersion: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    username?: string;
    tokenVersion?: number;
  }
}
