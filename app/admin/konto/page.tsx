import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { redirect } from "next/navigation";
import { KontoClient } from "./konto-client";

export default async function KontoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      totpEnabled: true,
      webAuthnCredentials: {
        select: { id: true, name: true, deviceType: true, lastUsed: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Konto-Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Benutzername, E-Mail, Passwort, Zwei-Faktor-Authentifizierung und Passkeys.
        </p>
      </div>

      <KontoClient
        username={user.username}
        email={user.email}
        totpEnabled={user.totpEnabled}
        passkeys={user.webAuthnCredentials}
      />
    </div>
  );
}
