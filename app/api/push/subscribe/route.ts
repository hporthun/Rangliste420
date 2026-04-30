import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { isPushEnabled } from "@/lib/push/config";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * Speichert eine Browser-Push-Subscription (Issue #36). Anonym — Public
 * Visitors sollen abonnieren können, ohne Account. Wenn dieselbe Endpoint-URL
 * schon existiert (z. B. nach SW-Neuregistrierung), wird der Datensatz nur
 * aktualisiert, nicht dupliziert.
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

  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
    },
    update: {
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
