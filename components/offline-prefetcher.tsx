"use client";

import { useEffect } from "react";

/**
 * Lädt im Hintergrund alle öffentlichen Lese-URLs in den Service-Worker-
 * Cache, sodass Ranglisten, Regatten und Steuermann-Detailseiten auch
 * ohne Vorbesuch offline erreichbar sind.
 *
 * Ablauf:
 *   1. Auf SW-Aktivierung warten (`navigator.serviceWorker.ready`).
 *   2. `/api/offline-manifest` abrufen — Liste der zu cachenden URLs.
 *   3. Liste per `postMessage` an den aktiven SW schicken; der lädt sie
 *      mit begrenzter Parallelität in `420-pages-v1`.
 *
 * Drosselung:
 *   - Nur einmal pro 30 Minuten pro Browser (localStorage-Timestamp).
 *   - Nicht auf Admin-/Auth-Routen — dort wird nie offline gelesen.
 *
 * Fehler sind silent — die Seite funktioniert ohne Prefetch genauso.
 */

const STORAGE_KEY = "420ranking:offline-prefetched-at";
const STALE_MS = 30 * 60 * 1000;

export function OfflinePrefetcher() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const path = window.location.pathname;
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;

    try {
      const last = parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
      if (Number.isFinite(last) && Date.now() - last < STALE_MS) return;
    } catch {
      // ignore — localStorage kann in privatem Modus blockiert sein
    }

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (cancelled || !reg.active) return;

        const res = await fetch("/api/offline-manifest", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { urls?: unknown };
        const urls = Array.isArray(data.urls)
          ? data.urls.filter((u): u is string => typeof u === "string")
          : [];
        if (cancelled || !reg.active || urls.length === 0) return;

        reg.active.postMessage({ type: "PREFETCH", urls });

        try {
          window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          // ignore
        }
      } catch {
        // best effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
