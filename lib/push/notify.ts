import webPush from "web-push";
import { db } from "@/lib/db/client";
import { getPushConfig } from "./config";

/**
 * Push-Broadcast an alle abonnierten Browser (Issue #36).
 *
 * Tote Subscriptions (HTTP 404 = "endpoint nicht mehr gültig", HTTP 410 =
 * "subscription wurde aufgehoben") werden direkt aus der DB entfernt — sonst
 * würde die Liste über die Zeit wachsen und jede Broadcast-Rundreise
 * verlangsamen.
 *
 * Fehler beim Senden bremsen den Aufrufer NICHT: alle Promises werden
 * parallel mit `allSettled` gefahren, und die Funktion ist als Best-Effort
 * gedacht — der Server-Action-Pfad (z. B. publishRankingAction) soll nie
 * scheitern, weil Push-Provider X gerade laggt.
 */

export type PushPayload = {
  /** Titel der Notification (max ~60 Zeichen, OS-abhängig). */
  title: string;
  /** Body, kurz halten (~120 Zeichen). */
  body: string;
  /** Ziel-URL beim Klick auf die Notification. Default: "/". */
  url?: string;
  /** Wert für die App-Plakette. 0 = clearBadge. Weglassen = unverändert. */
  count?: number;
  /**
   * Notification-Tag — neue Notifications mit demselben Tag ersetzen alte,
   * statt sich zu stapeln. Default "ranking-update".
   */
  tag?: string;
};

let configured = false;

function configure() {
  if (configured) return true;
  const cfg = getPushConfig();
  if (!cfg) return false;
  webPush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  configured = true;
  return true;
}

export type BroadcastResult = {
  /** Anzahl erfolgreich zugestellter Pushes. */
  delivered: number;
  /** Anzahl verworfener (toter) Subscriptions, die entfernt wurden. */
  pruned: number;
  /** Anzahl Fehlschläge ohne Pruning (transiente Fehler). */
  failed: number;
};

export async function broadcastPush(
  payload: PushPayload,
): Promise<BroadcastResult> {
  if (!configure()) {
    return { delivered: 0, pruned: 0, failed: 0 };
  }

  const subs = await db.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return { delivered: 0, pruned: 0, failed: 0 };

  const json = JSON.stringify(payload);
  const deadIds: string[] = [];
  let delivered = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
        delivered++;
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : null;
        if (status === 404 || status === 410) {
          deadIds.push(s.id);
        } else {
          failed++;
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    await db.pushSubscription
      .deleteMany({ where: { id: { in: deadIds } } })
      .catch(() => {
        // Cleanup is best-effort; failure here would just leave stale rows
        // for the next broadcast to re-discover.
      });
  }

  return { delivered, pruned: deadIds.length, failed };
}
