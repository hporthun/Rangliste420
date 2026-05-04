"use client";

/**
 * Push-Aktivierungs-Sektion auf der Konto-Seite.
 *
 * Wieder-Einstieg fuer User, die den Push-Banner mit "Nicht jetzt" weggeklickt
 * haben (oder ihn nie zu Gesicht bekamen, weil sie sich vorher angemeldet
 * hatten und der Banner nur unangemeldet erscheint). Die Komponente spiegelt
 * den Zustand der bestehenden Subscription wider und bietet:
 *   - Aktivieren (Service-Worker-Register + PushManager.subscribe + DB-POST)
 *   - Abbestellen (Subscription kuendigen + DB-DELETE)
 *
 * Sonderfaelle:
 *   - Browser ohne Push-Support (z. B. iOS Safari ausserhalb der PWA): wir
 *     zeigen einen iOS-spezifischen Hinweis statt einer ausgegrauten Schaltflaeche
 *   - Notification.permission === "denied": der Browser muss zuerst die
 *     Berechtigung zuruecksetzen, das koennen wir programmatisch nicht
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, AlertTriangle, Loader2, Smartphone } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "no-vapid" }
  | { kind: "idle" }
  | { kind: "subscribed"; endpoint: string };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
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

/**
 * Heuristik: laeuft die App im "installed PWA"-Modus?
 * - display-mode media query "standalone" → Android/Chromium
 * - navigator.standalone (legacy iOS Safari) → iOS Home-Screen-Icon
 */
function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  type LegacyNavigator = Navigator & { standalone?: boolean };
  const nav = navigator as LegacyNavigator;
  if (nav.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

function isLikelyIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PushAccountSection() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialer Status-Check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isBrowserSupported()) {
        if (!cancelled) setState({ kind: "unsupported" });
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState({ kind: "denied" });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            if (!cancelled)
              setState({ kind: "subscribed", endpoint: sub.endpoint });
            return;
          }
        }
        // VAPID muss konfiguriert sein, sonst koennen wir nicht subscriben.
        const res = await fetch("/api/push/vapid", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "no-vapid" });
          return;
        }
        if (!cancelled) setState({ kind: "idle" });
      } catch {
        if (!cancelled) setState({ kind: "unsupported" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState({ kind: perm === "denied" ? "denied" : "idle" });
        return;
      }
      const vapidRes = await fetch("/api/push/vapid", { cache: "no-store" });
      if (!vapidRes.ok) {
        setState({ kind: "no-vapid" });
        return;
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const submitRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!submitRes.ok) {
        await sub.unsubscribe().catch(() => {});
        setError("Subscription konnte nicht gespeichert werden.");
        setState({ kind: "idle" });
        return;
      }
      setState({ kind: "subscribed", endpoint: sub.endpoint });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState({ kind: "idle" });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onUnsubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
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
      setState({ kind: "idle" });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (state.kind === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Status wird geprüft…
      </p>
    );
  }

  if (state.kind === "unsupported") {
    const ios = isLikelyIos();
    const installed = isStandalonePwa();
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <p>
            Dein Browser unterstützt keine Push-Benachrichtigungen.
            {ios && !installed && (
              <>
                {" "}Auf iPhone/iPad ist Web-Push nur in der{" "}
                <strong>als PWA installierten App</strong> verfügbar — siehe
                Hinweis unten.
              </>
            )}
          </p>
        </div>
        {ios && !installed && (
          <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="flex items-center gap-1.5 font-semibold">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              iPhone / iPad — als PWA installieren
            </p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>In Safari auf das Teilen-Symbol (Quadrat mit Pfeil) tippen.</li>
              <li>
                <em>&bdquo;Zum Home-Bildschirm&ldquo;</em> wählen → <em>Hinzufügen</em>.
              </li>
              <li>Auf dem Home-Bildschirm das neue 420er-Icon antippen (nicht erneut über Safari öffnen!).</li>
              <li>Diese Konto-Seite aufrufen — die Aktivierungs-Schaltfläche erscheint dann.</li>
            </ol>
            <p className="text-blue-800/80 dark:text-blue-200/80">
              Voraussetzung: iOS 16.4 oder neuer.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <p className="text-muted-foreground">
          Benachrichtigungen wurden für diese Seite{" "}
          <strong>blockiert</strong>. Du kannst die Berechtigung im Browser
          zurücksetzen (Schloss-Symbol in der Adressleiste → Benachrichtigungen
          erlauben) und die Seite neu laden.
        </p>
      </div>
    );
  }

  if (state.kind === "no-vapid") {
    return (
      <p className="text-sm text-muted-foreground">
        Push-Benachrichtigungen sind serverseitig (noch) nicht konfiguriert.
        Bitte den Administrator kontaktieren.
      </p>
    );
  }

  if (state.kind === "subscribed") {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <Bell className="h-4 w-4 shrink-0" />
          Benachrichtigungen sind aktiv für diesen Browser.
        </p>
        <button
          type="button"
          onClick={onUnsubscribe}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BellOff className="h-3.5 w-3.5" />
          )}
          Abbestellen
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Erhalte eine Browser-Notification, sobald eine neue Rangliste
        veröffentlicht oder die App auf eine neue Version aktualisiert wird.
      </p>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bell className="h-3.5 w-3.5" />
        )}
        Aktivieren
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
