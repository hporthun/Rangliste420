import { NextResponse } from "next/server";
import { getPushConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/**
 * Veröffentlicht den VAPID-Public-Key für den Subscribe-Flow im Browser
 * (Issue #36). Ohne konfigurierte VAPID-Variablen → 503, das Banner schaltet
 * sich dann auf der Client-Seite aus.
 */
export async function GET() {
  const cfg = getPushConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Push ist auf diesem Server nicht konfiguriert." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: cfg.publicKey });
}
