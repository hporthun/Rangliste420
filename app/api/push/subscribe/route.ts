import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { isPushEnabled } from "@/lib/push/config";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * Speichert eine Browser-Push-Subscription (Issue #36).
 *
 * Anonym oder eingeloggt: bei vorhandener Session wird userId mitgespeichert,
 * sonst bleibt die Subscription anonym. Wenn dieselbe Endpoint-URL schon
 * existiert (z. B. nach SW-Neuregistrierung oder beim Re-Sync auf der
 * Einstellungs-Seite), wird der Datensatz aktualisiert, nicht dupliziert —
 * das laesst auch eine zuvor anonym angelegte Subscription nachtraeglich an
 * den eingeloggten Benutzer binden, sobald er die Seite mit aktiver Session
 * neu laedt.
 *
 * Update-Notifications (App-Versionssprung) gehen ausschliesslich an
 * Subscriptions mit userId IS NOT NULL — Public-Visitors sollen kein
 * "App aktualisiert"-Pop-up sehen, das fuer sie keinen Mehrwert hat.
 * Inhaltsbasierte Pushes (neue Rangliste) erreichen weiterhin alle.
 */
export async function POST(req: NextRequest) {
  if (!isPushEnabled()) {
    return NextResponse.json(
      { error: "Push ist auf diesem Server nicht konfiguriert." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Subscription.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
      userId,
    },
    update: {
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
      // userId nur ueberschreiben, wenn aktuell eine Session besteht — eine
      // anonyme Resync-Aktion (User wieder ausgeloggt) soll die bestehende
      // Verknuepfung nicht loeschen. Beim ersten Re-Subscribe einer angemeldeten
      // Session wird die anonyme Sub mit der userId verheiratet.
      ...(userId ? { userId } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
