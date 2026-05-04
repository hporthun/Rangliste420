"use client";

/**
 * Sichtbarer Update-Indicator im Header.
 *
 * Zeigt eine Glocke + roten Dot, sobald es ungelesene neue Inhalte gibt
 * (neue oeffentliche Rangliste, neue Regatta, oder neuer Changelog-Eintrag).
 * Klick oeffnet ein kleines Popover mit der Liste — pro Eintrag ein Link
 * direkt zur Detailseite (Rangliste oder Regatta) bzw. zum Changelog.
 *
 * Der "gesehen"-Status wird in localStorage unter dem gleichen Key wie der
 * AppBadge (Issue #35) gepflegt — beide bleiben damit konsistent.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  type BadgeState,
  type SeenState,
  EMPTY_SEEN,
  isFirstTimeUser,
  seenPatchFor,
  unreadItems,
  type UnreadItem,
} from "@/lib/badge";

const STORAGE_KEY = "appBadge:seen:v1";
// 60 s — Kompromiss zwischen Frische und Server-Last. Bei eingehendem Push
// triggert der Service-Worker-postMessage zusaetzlich einen Sofort-Refresh.
const POLL_INTERVAL_MS = 60 * 1000;

function readSeen(): SeenState {
  if (typeof window === "undefined") return EMPTY_SEEN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SEEN;
    const parsed = JSON.parse(raw) as Partial<SeenState>;
    return {
      changelogVersion: parsed.changelogVersion ?? null,
      regattaCreatedAt: parsed.regattaCreatedAt ?? null,
      rankingPublishedAt: parsed.rankingPublishedAt ?? null,
    };
  } catch {
    return EMPTY_SEEN;
  }
}

function writeSeen(seen: SeenState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* Quota / private mode — ignorieren */
  }
}

const KIND_LABELS: Record<UnreadItem["kind"], string> = {
  ranking: "Neue Rangliste",
  regatta: "Neue Regatta",
  changelog: "App-Update",
};

export function UpdateIndicator() {
  const pathname = usePathname();
  const [items, setItems] = useState<UnreadItem[]>([]);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Polling + Listeners. Pathname ist Dependency, damit der Effekt nach
  // Navigation neu durchlaeuft und seenPatchFor angewendet wird — z. B. wenn
  // der Klick auf die Glocke zu /rangliste/[id] navigiert, dort die
  // ranking-Kategorie als gesehen markiert und die Glocke wieder verschwindet.
  useEffect(() => {
    let cancelled = false;
    let lastState: BadgeState | null = null;

    function recompute() {
      if (!lastState) return;
      let seen = readSeen();

      // Erstbesucher: aktuellen Stand als "gesehen" festhalten — sonst
      // bekommt ein neuer User auf Anhieb eine rote Glocke fuer Inhalte,
      // die ihm noch nie angekuendigt wurden.
      if (isFirstTimeUser(seen)) {
        seen = {
          changelogVersion: lastState.latestChangelogVersion,
          regattaCreatedAt: lastState.latestRegattaCreatedAt,
          rankingPublishedAt: lastState.latestRankingPublishedAt,
        };
        writeSeen(seen);
      }

      // Aktuelle URL → Kategorie als gesehen markieren (wenn der User auf
      // /rangliste oder /rangliste/[id] landet, gilt die ranking-Kategorie
      // als gesehen). Identische Logik wie im AppBadge — beide schreiben
      // in denselben localStorage-Key, deshalb keine Konflikte.
      const patch = seenPatchFor(pathname ?? "/", lastState);
      if (patch) {
        seen = { ...seen, ...patch };
        writeSeen(seen);
      }

      setItems(unreadItems(lastState, seen));
    }

    async function refresh() {
      try {
        const res = await fetch("/api/badge", { cache: "no-store" });
        if (!res.ok) return;
        const state = (await res.json()) as BadgeState;
        if (cancelled) return;
        lastState = state;
        recompute();
      } catch {
        // Network — letzten Stand behalten.
      }
    }

    void refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Storage-Event feuert nur fuer ANDERE Tabs — eigener Tab wird durch
    // das pathname-trigger oben + manuelle Aufrufe abgedeckt. Dieser
    // Listener sorgt dafuer, dass das Markieren als gesehen in einem
    // anderen Tab hier auch durchschlaegt.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) recompute();
    };
    window.addEventListener("storage", onStorage);

    // Service-Worker meldet eingehende Push-Notifications via postMessage —
    // dann sofort frisch ziehen, statt auf den naechsten Poll zu warten.
    const onSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "PUSH_RECEIVED") {
        void refresh();
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
      window.clearInterval(interval);
    };
  }, [pathname]);

  // Outside-Click schliesst Popover
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (items.length === 0) return null;

  // Bei genau 1 Eintrag: Klick auf die Glocke fuehrt direkt zum Ziel,
  // ohne Popover. Sonst Popover oeffnen.
  const directHref = items.length === 1 ? items[0].href : null;

  return (
    <div className="relative">
      {directHref ? (
        <Link
          ref={buttonRef as unknown as React.Ref<HTMLAnchorElement>}
          href={directHref}
          title={items[0].label}
          aria-label={`${KIND_LABELS[items[0].kind]}: ${items[0].label}`}
          className="relative flex items-center justify-center w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--maritime-header-bg,theme(colors.primary.DEFAULT))]"
            aria-hidden
          />
        </Link>
      ) : (
        <>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Updates"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`${items.length} neue Updates`}
            className="relative flex items-center justify-center w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span
              className="absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-bold text-center"
              aria-hidden
            >
              {items.length}
            </span>
          </button>
          {open && (
            <div
              ref={popoverRef}
              role="menu"
              className="absolute right-0 mt-1 w-64 rounded-md border bg-card shadow-lg overflow-hidden z-50"
            >
              <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                Updates
              </div>
              <ul className="divide-y divide-border/60">
                {items.map((it) => (
                  <li key={it.kind}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className="flex flex-col gap-0.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {KIND_LABELS[it.kind]}
                      </span>
                      <span className="font-medium leading-tight">
                        {it.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
