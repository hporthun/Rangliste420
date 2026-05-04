/* Service Worker für Web-Push (Issue #36) und Offline-Lese-Cache.
 *
 * Funktion 1 — Push-Notifications (unverändert seit Issue #36):
 *   Eingehende Push-Nachrichten in eine Notification + App-Badge verwandeln.
 *
 * Funktion 2 — Offline-Lese-Cache (öffentliche App):
 *   Statische Assets, Bilder und zuletzt besuchte Public-Seiten werden
 *   gecacht, damit Ranglisten/Regatta-/Segler-Detailseiten ohne Netz
 *   weiter aufrufbar sind. Schreibvorgänge gibt es offline nicht — der
 *   Admin-Bereich (/admin), die Auth-Routen (/auth) und alle API-Routen
 *   (/api) werden absichtlich NICHT gecacht: dort braucht es immer Live-
 *   Daten und gültige Sessions.
 *
 * Update-Strategie:
 *   - skipWaiting + clients.claim → neue SW-Version übernimmt sofort.
 *   - CACHE_VERSION bumpen, wenn sich Cache-Layout oder Logik ändern.
 *     Alte Caches werden in `activate` aufgeräumt.
 *
 * Payload-Schema der Push-Nachrichten (vom Server gesendet):
 *   {
 *     title:  string                   — Notification-Titel
 *     body:   string                   — kurzer Text
 *     url?:   string                   — Ziel beim Klick (default "/")
 *     count?: number                   — Wert für setAppBadge (0 = clearBadge)
 *     tag?:   string                   — Notification-Tag (Replace statt Stack)
 *   }
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `420-static-${CACHE_VERSION}`;
const PAGES_CACHE = `420-pages-${CACHE_VERSION}`;
const IMG_CACHE = `420-img-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, IMG_CACHE];

// Werden beim Install vorab geladen, damit die Offline-Seite und das App-
// Icon auch ohne vorherigen Besuch der Seite verfügbar sind.
const PRECACHE_URLS = ["/offline", "/icon.svg", "/logo-420.png"];

// Auf dem Dev-Server (localhost) NICHT in Fetches eingreifen — sonst
// blockiert der SW HMR und maskiert frische Assets bei jedem Reload.
// Push funktioniert trotzdem, weil die Push-Handler unten unabhängig
// von dieser Variable arbeiten.
const IS_DEV =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

// — Install: Offline-Seite + Statics vorladen ——————————————————————————
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // `cache.addAll` würde bei einem einzigen 404 alles abbrechen — wir
      // wollen aber, dass der SW startet, auch wenn z.B. /offline noch
      // nicht deployed ist.
      Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)),
      ),
    ),
  );
  self.skipWaiting();
});

// — Activate: alte Cache-Versionen wegräumen + sofort übernehmen ————————
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("420-") && !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// — Fetch: Cache-Strategien für den Lese-Modus ————————————————————————
self.addEventListener("fetch", (event) => {
  if (IS_DEV) return;

  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Niemals cachen: Admin/Auth/API + Server-Sent-Events.
  // Auth-Cookies und Session-Daten dürfen nicht in den Cache geraten.
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // Gehashte Next.js-Assets sind immutable → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Bilder/Icons → stale-while-revalidate (schnell + selbst-aktualisierend).
  // /_next/image ist die Next.js-Image-Optimization-Pipeline; das Header-Logo
  // und alle <Image>-Aufrufe laufen darueber und liefern z.B.
  //   /_next/image?url=%2Flogo-420.png&w=256&q=75
  // — der Pfad endet nicht auf .png, deshalb explizit als Praefix mit-listen.
  if (
    /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname) ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/_next/image")
  ) {
    event.respondWith(staleWhileRevalidate(req, IMG_CACHE));
    return;
  }

  // Seiten-Navigationen + RSC-Requests → network-first mit Offline-Fallback.
  const isNavigation = req.mode === "navigate";
  const isRsc =
    req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

  if (isNavigation || isRsc) {
    event.respondWith(networkFirstPage(req));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const res = await fetch(req);
    // Nur „gesunde" same-origin-Antworten cachen, keine Redirects/4xx/5xx.
    if (res.ok && res.type === "basic") {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const fallback = await caches.match("/offline");
      if (fallback) return fallback;
    }
    throw err;
  }
}

// — Prefetch: Hintergrund-Befüllung des Page-Caches —————————————————————
// Der `OfflinePrefetcher` (components/offline-prefetcher.tsx) holt die Liste
// aller öffentlichen URLs vom Server und schickt sie hier per postMessage
// rein. Der SW lädt sie mit begrenzter Parallelität und legt sie im
// PAGES_CACHE ab, sodass Detailseiten auch ohne Vorbesuch offline da sind.
const PREFETCH_CONCURRENCY = 4;
const PREFETCH_FRESH_MS = 30 * 60 * 1000;

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "PREFETCH") return;
  if (IS_DEV) return;
  const urls = event.data.urls;
  if (!Array.isArray(urls)) return;
  event.waitUntil(prefetchUrls(urls));
});

async function prefetchUrls(urls) {
  const cache = await caches.open(PAGES_CACHE);
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        // Bereits frisch im Cache? Dann sparen wir uns den Round-Trip.
        const existing = await cache.match(url);
        if (existing) {
          const dateHeader = existing.headers.get("date");
          if (dateHeader) {
            const age = Date.now() - new Date(dateHeader).getTime();
            if (Number.isFinite(age) && age < PREFETCH_FRESH_MS) continue;
          }
        }
        const res = await fetch(url, { credentials: "same-origin" });
        if (res.ok && res.type === "basic") {
          await cache.put(url, res);
        }
      } catch {
        // Einzel-Fehler ignorieren, der Rest läuft weiter.
      }
    }
  }

  const workers = [];
  const n = Math.min(PREFETCH_CONCURRENCY, urls.length);
  for (let k = 0; k < n; k++) workers.push(worker());
  await Promise.all(workers);
}

// — Push (unverändert, Issue #36) ————————————————————————————————————————
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
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    // 1) Wenn ein Fenster bereits exakt auf der Ziel-URL steht → nur fokussieren.
    for (const w of wins) {
      if (w.url.endsWith(targetUrl) && "focus" in w) {
        return w.focus();
      }
    }

    // 2) Sonst irgendein offenes App-Fenster wiederverwenden, fokussieren UND
    //    zur Ziel-URL navigieren — so springt der bestehende Tab zur neuen
    //    Rangliste / zu den Update-Notes, statt einen weiteren Tab zu oeffnen.
    const sameSite = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (sameSite) {
      try {
        await sameSite.focus();
      } catch { /* manche Browser lehnen focus ohne User-Geste ab */ }
      if (typeof sameSite.navigate === "function") {
        try {
          await sameSite.navigate(targetUrl);
          return;
        } catch { /* navigate kann fehlschlagen, dann faellt es auf openWindow */ }
      }
    }

    // 3) Fallback: neues Fenster oeffnen.
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
