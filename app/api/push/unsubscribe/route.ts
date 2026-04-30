import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * Entfernt eine Push-Subscription anhand ihrer Endpoint-URL (Issue #36).
 * Idempotent: nicht-existierende Endpoints liefern trotzdem 200, damit der
 * Client-Flow (Banner-„Aus") nie hängenbleibt.
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = unsubscribeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  await db.pushSubscription
    .delete({ where: { endpoint: parsed.data.endpoint } })
    .catch(() => {
      // Already gone — treat as success.
    });

  return NextResponse.json({ ok: true });
}
