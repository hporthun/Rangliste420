"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

/**
 * Dezenter Banner zum Abonnieren von Push-Updates (Issue #36).
 *
 * Wird unter dem Header angezeigt — nur, wenn:
 *   - der Browser Push + Service Worker unterstützt
 *   - der Server VAPID konfiguriert hat (/api/push/vapid → 200)
 *   - der Nutzer noch nicht abonniert UND nicht "Nicht jetzt" geklickt hat
 *
 * Nach Klick auf "Aktivieren" wird die Notification-Permission abgefragt;
 * verweigert der Nutzer, verschwindet der Banner für 30 Tage. Bei Erfolg
 * registriert sich der Service Worker, abonniert mit dem Public-Key vom
 * Server und speichert den Endpoint in der DB.
 *
 * Status nach erfolgreichem Subscribe wird im DOM angezeigt (kleine Pille
 * oben rechts) und kann mit Klick wieder abbestellt werden.
 */

const DISMISS_KEY = "pushBanner:dismissedUntil:v1";
const DISMISS_DAYS = 30;

type State =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "ask" }
  | { kind: "subscribed"; endpoint: string };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  // Explicitly use a fresh ArrayBuffer (not SharedArrayBuffer) so the type
  // matches BufferSource expected by PushManager.subscribe.
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isBrowserSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  return true;
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
    );
  } catch {
    // ignore
  }
}

export function PushBanner() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Initial: check support + current subscription state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isBrowserSupported()) {
        setState({ kind: "hidden" });
        return;
      }
      // Permission already denied → kein Banner anzeigen, der User hat sich
      // schon entschieden. (Browser-Reset über die Adressleiste nötig.)
      if (Notification.permission === "denied") {
        setState({ kind: "hidden" });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            if (!cancelled) setState({ kind: "subscribed", endpoint: sub.endpoint });
            return;
          }
        }
        if (isDismissed()) {
          if (!cancelled) setState({ kind: "hidden" });
          return;
        }
        // Server muss VAPID konfiguriert haben — sonst kein Banner.
        const res = await fetch("/api/push/vapid", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "hidden" });
          return;
        }
        if (!cancelled) setState({ kind: "ask" });
      } catch {
        if (!cancelled) setState({ kind: "hidden" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        dismiss();
        setState({ kind: "hidden" });
        return;
      }

      const vapidRes = await fetch("/api/push/vapid", { cache: "no-store" });
      if (!vapidRes.ok) {
        setState({ kind: "hidden" });
        return;
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      const submitRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!submitRes.ok) {
        await sub.unsubscribe().catch(() => {});
        setState({ kind: "hidden" });
        return;
      }

      setState({ kind: "subscribed", endpoint: sub.endpoint });
    } catch {
      setState({ kind: "hidden" });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onUnsubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setState({ kind: "hidden" });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onDismiss = useCallback(() => {
    dismiss();
    setState({ kind: "hidden" });
  }, []);

  if (state.kind === "loading" || state.kind === "hidden") return null;

  if (state.kind === "subscribed") {
    return (
      <div className="border-b border-border/50 bg-emerald-50/60 dark:bg-emerald-900/10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
            <Bell className="h-3.5 w-3.5" aria-hidden />
            Benachrichtigungen sind aktiv.
          </span>
          <button
            type="button"
            onClick={onUnsubscribe}
            disabled={busy}
            className="inline-flex items-center gap-1 text-emerald-900/70 dark:text-emerald-200/70 hover:text-emerald-900 dark:hover:text-emerald-100 underline disabled:opacity-50"
          >
            <BellOff className="h-3 w-3" aria-hidden />
            Abbestellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/50 bg-muted/40">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Bei neuen Ranglisten oder Regatten benachrichtigt werden?
          </span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSubscribe}
            disabled={busy}
            className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "…" : "Aktivieren"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            aria-label="Banner ausblenden"
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
