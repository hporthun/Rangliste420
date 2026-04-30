/* Service Worker für Web-Push (Issue #36).
 *
 * Bewusst minimal — keine Caching-Strategien, kein Offline-First. Das einzige
 * Ziel: einkommende Push-Nachrichten in eine Notification + App-Badge
 * verwandeln. Browser verlangen, dass jede Push-Nachricht eine sichtbare
 * Notification erzeugt, sonst zeigen sie selbst eine generische an oder
 * heben die Subscription auf. Wir nutzen das also als regulären
 * Notification-Kanal.
 *
 * Payload-Schema (vom Server gesendet):
 *   {
 *     title:  string                   — Notification-Titel
 *     body:   string                   — kurzer Text
 *     url?:   string                   — Ziel beim Klick (default "/")
 *     count?: number                   — Wert für setAppBadge (0 = clearBadge)
 *     tag?:   string                   — Notification-Tag (Replace statt Stack)
 *   }
 */

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "420er Rangliste", body: event.data.text() };
    }
  }

  const title = data.title || "420er Rangliste";
  const options = {
    body: data.body || "Neue Inhalte verfügbar.",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: data.tag || "ranking-update",
    data: { url: data.url || "/" },
  };

  // Sichtbare Notification UND App-Badge — beides parallel.
  const tasks = [self.registration.showNotification(title, options)];

  if (typeof data.count === "number" && self.navigator) {
    if (data.count > 0 && self.navigator.setAppBadge) {
      tasks.push(self.navigator.setAppBadge(data.count).catch(() => {}));
    } else if (self.navigator.clearAppBadge) {
      tasks.push(self.navigator.clearAppBadge().catch(() => {}));
    }
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          // Bestehendes Fenster wiederverwenden, wenn es schon auf der Seite ist
          if (w.url.endsWith(targetUrl) && "focus" in w) {
            return w.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// Sofort aktiv werden — sonst übernimmt der neue SW erst beim nächsten
// Tab-Reload, was Subscriptions verzögert.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
