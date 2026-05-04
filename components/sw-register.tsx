"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker für den Offline-Lese-Cache.
 *
 * Idempotent — `navigator.serviceWorker.register` ist auch dann safe,
 * wenn der `<PushBanner>` (Issue #36) die gleiche `/sw.js` ein zweites
 * Mal registriert; der Browser liefert die bestehende Registration
 * zurück. Wir registrieren hier so früh wie möglich, damit der SW auch
 * bei Nutzern aktiv ist, die den Push-Banner ablehnen oder schließen.
 *
 * Im Dev-Modus tut der SW selbst nichts beim Fetch (siehe public/sw.js),
 * der Push-Pfad funktioniert aber trotzdem — daher hier keine Env-Logik.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Best-effort — Fehler hier sind nicht user-facing.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
