import Link from "next/link";
import { listUsersAction } from "@/lib/actions/users";
import { requireRole } from "@/lib/auth-guard";
import { CreateUserForm } from "./create-form";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

export default async function BenutzerPage() {
  const me = await requireRole("ADMIN");
  const result = await listUsersAction();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Übersicht
        </Link>
        <h1 className="text-xl font-semibold">Benutzerverwaltung</h1>
        <p className="text-sm text-red-600">Fehler: {result.error}</p>
      </div>
    );
  }

  const users = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Übersicht
        </Link>
        <h1 className="text-xl font-semibold mt-1">Benutzerverwaltung</h1>
        <p className="text-sm text-muted-foreground">
          Konten anlegen, bearbeiten, sperren oder löschen. Editor-Konten können
          Segler, Regatten und Ranglisten pflegen — Wartung und Benutzerverwaltung
          bleiben Admins vorbehalten.
        </p>
      </div>

      <section className="rounded-md border p-4 space-y-3 bg-gray-50">
        <h2 className="font-semibold text-base">Neuen Benutzer anlegen</h2>
        <CreateUserForm />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Bestehende Benutzer ({users.length})</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Benutzer</th>
                <th className="px-4 py-2 text-left">Rolle</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Letzter Login</th>
                <th className="px-4 py-2 text-left">2FA / Passkeys</th>
                <th className="px-4 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <UserRow key={u.id} user={u} currentUserId={me.userId} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
