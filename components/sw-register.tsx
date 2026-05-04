"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker für den Offline-Lese-Cache.
 *
 * Idempotent — `navigator.serviceWorker.register` ist auch dann safe,
 * wenn die `PushAccountSection` (auf /einstellungen oder im Konto)
 * die gleiche `/sw.js` ein zweites Mal registriert; der Browser
 * liefert die bestehende Registration zurueck. Wir registrieren hier
 * so frueh wie moeglich, damit der SW auch bei Nutzern aktiv ist,
 * die Push-Benachrichtigungen nicht aktivieren.
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
