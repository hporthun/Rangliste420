/**
 * Server-side auth guard helpers.
 *
 * NextAuth v5 unterstützt mit dem Credentials-Provider keine `database`-Sessions
 * (Auth.js-Limitation, Stand 2026-05). Damit „Rauswerfen" und „Sperren" trotzdem
 * sofort wirken, schreiben wir die `tokenVersion` und ein `disabledAt`-Feld
 * direkt in die `User`-Tabelle und prüfen sie hier auf jeder Anfrage:
 *
 * - JWT-Callback in lib/auth.ts hängt `tokenVersion` an den Token an.
 * - `requireSession()` (und der Layout-Guard) lesen den User-Datensatz und
 *   verwerfen Tokens, deren tokenVersion nicht mehr stimmt oder deren User
 *   gesperrt wurde — der Aufrufer wird dann zur Login-Seite umgeleitet.
 *
 * Effekt: 1 zusätzliche DB-Anfrage pro authentifizierter Admin-Anfrage,
 * dafür sind „Rauswerfen" (tokenVersion++) und „Sperren" (disabledAt setzen)
 * sofort wirksam — gleichwertig zu Database-Sessions, ohne den Adapter.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { redirect } from "next/navigation";

export type Role = "ADMIN" | "EDITOR";

export type GuardedSession = {
  userId: string;
  username: string | null;
  email: string | null;
  role: Role;
};

/**
 * Validates the current request's session: refreshes the user from the DB,
 * checks `disabledAt` und `tokenVersion`. Bei Mismatch: Redirect auf
 * /auth/login (das Cookie kann hier nicht gelöscht werden, da Layouts/RSC
 * keine Cookies modifizieren dürfen — beim erneuten Login wird der alte JWT
 * sowieso überschrieben, und solange der Status-Check fehlschlägt, kommt der
 * User auch mit altem Cookie nicht in den Admin-Bereich).
 * Returns the verified user data on success.
 */
export async function requireSession(): Promise<GuardedSession> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      disabledAt: true,
      tokenVersion: true,
    },
  });

  // Account deleted, disabled, oder tokenVersion erhöht (Rauswerfen)
  // → Session ist nicht mehr gültig. Redirect auf Login-Seite.
  if (
    !user ||
    user.disabledAt !== null ||
    user.tokenVersion !== session.user.tokenVersion
  ) {
    redirect("/auth/login");
  }

  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role as Role,
  };
}

/**
 * Wrapper around requireSession that also enforces a minimum role. Editor and
 * Admin both pass `requireRole("EDITOR")`; nur Admin passt `requireRole("ADMIN")`.
 */
export async function requireRole(minimumRole: Role): Promise<GuardedSession> {
  const guarded = await requireSession();
  if (minimumRole === "ADMIN" && guarded.role !== "ADMIN") {
    redirect("/admin");
  }
  return guarded;
}
