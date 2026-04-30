"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  type BadgeState,
  type SeenState,
  EMPTY_SEEN,
  countNew,
  isFirstTimeUser,
  seenPatchFor,
} from "@/lib/badge";

/**
 * App-Badging-Brücke (Issue #35).
 *
 * Setzt eine numerische Plakette auf das installierte PWA-Symbol, sobald
 * "neue" Inhalte vorliegen. Was als neu gilt, wird pro Browser/Installation
 * in localStorage festgehalten — der Server kennt keinen Nutzerzustand.
 *
 * Drei Kategorien tragen je 1 zur Zählung bei, wenn sie aktualisiert wurden:
 *   - Changelog-Eintrag (Versionsbump)
 *   - neueste sichtbare Ranglistenregatta
 *   - neueste veröffentlichte Rangliste
 *
 * Die Anzeige aktualisiert sich beim Öffnen der App, Tab-Wechsel und alle
 * 5 Minuten im Vordergrund. Echte Hintergrund-Aktualisierungen (App ist zu)
 * würden Web-Push voraussetzen — bewusst nicht im Scope.
 *
 * Mark-as-seen passiert automatisch beim Aufruf der jeweiligen Listen:
 *   /admin/changelog → Changelog markieren
 *   /regatten        → Regatta markieren
 *   /rangliste       → Rangliste markieren
 *
 * Browser ohne Badging-API ignorieren die Aufrufe stillschweigend; auf iOS
 * verlangt das System zusätzlich Notification-Permission, was hier nicht
 * eingefordert wird (kein Permission-Prompt für nicht-essenzielle UX).
 */

const STORAGE_KEY = "appBadge:seen:v1";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

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
    // Quota / private mode — silently ignore.
  }
}

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function applyBadge(count: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as NavigatorWithBadge;
  try {
    if (count > 0 && nav.setAppBadge) {
      void nav.setAppBadge(count);
    } else if (nav.clearAppBadge) {
      void nav.clearAppBadge();
    }
  } catch {
    // Unsupported / permission denied — ignore.
  }
}

export function AppBadge() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let lastState: BadgeState | null = null;

    async function refresh() {
      try {
        const res = await fetch("/api/badge", { cache: "no-store" });
        if (!res.ok) return;
        const state = (await res.json()) as BadgeState;
        if (cancelled) return;
        lastState = state;

        let seen = readSeen();

        // First-ever visit: seed everything to "current" so a brand-new user
        // doesn't see a stale badge for content they were never told about.
        if (isFirstTimeUser(seen)) {
          seen = {
            changelogVersion: state.latestChangelogVersion,
            regattaCreatedAt: state.latestRegattaCreatedAt,
            rankingPublishedAt: state.latestRankingPublishedAt,
          };
          writeSeen(seen);
        }

        const patch = seenPatchFor(pathname ?? "/", state);
        if (patch) {
          seen = { ...seen, ...patch };
          writeSeen(seen);
        }

        applyBadge(countNew(state, seen));
      } catch {
        // Network error — keep whatever badge is already set.
      }
    }

    void refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && lastState) {
        applyBadge(countNew(lastState, readSeen()));
      }
    };
    window.addEventListener("storage", onStorage);

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
