import { db } from "@/lib/db/client";
import { APP_VERSION } from "@/lib/version";
import { compareVersions } from "@/lib/changelog";
import { broadcastPush } from "./notify";

/**
 * Beim Server-Boot prüfen, ob seit der letzten Push-Auslieferung eine neuere
 * App-Version aktiv geworden ist (Issue #36). Wenn ja: einen Broadcast
 * senden und die Singleton-Marke `PushBroadcastState.lastPushedVersion`
 * vorrücken.
 *
 * Idempotent über mehrere Serverless-Instanzen hinweg, weil die Marke per
 * unique-Constraint (id = 1) in der DB liegt — eine zweite Instanz, die
 * unmittelbar danach hochfährt, sieht den bereits aktualisierten Wert und
 * sendet nichts mehr.
 */
export async function broadcastNewVersionIfNeeded(): Promise<void> {
  let state = await db.pushBroadcastState.findUnique({ where: { id: 1 } });
  if (!state) {
    // Allererster Boot: nicht nachträglich pushen, sondern still markieren —
    // sonst bekäme jeder Bestandskunde beim Rollout der Funktion eine
    // Update-Notification "willkommen".
    state = await db.pushBroadcastState.create({
      data: { id: 1, lastPushedVersion: APP_VERSION },
    });
    return;
  }

  if (
    state.lastPushedVersion &&
    compareVersions(APP_VERSION, state.lastPushedVersion) <= 0
  ) {
    return;
  }

  await db.pushBroadcastState.update({
    where: { id: 1 },
    data: { lastPushedVersion: APP_VERSION },
  });

  await broadcastPush(
    {
      title: "App aktualisiert",
      body: `Neue Version ${APP_VERSION} ist aktiv.`,
      url: "/admin/changelog",
      count: 1,
      tag: "app-version",
    },
    // Nur an angemeldete Subscriptions (Admins/Editors) — Public-Visitors
    // brauchen kein "App aktualisiert" mit Sprung in den Admin-Changelog.
    "loggedIn",
  );
}
