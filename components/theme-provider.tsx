"use client";

/**
 * Custom ThemeProvider — replaces next-themes to avoid React 19's
 * "Encountered a script tag while rendering React component" warning.
 *
 * next-themes renders an inline <script dangerouslySetInnerHTML> inside
 * a React component to prevent FOUC. React 19 warns about any inline script
 * element in a component tree (because it won't re-execute on the client).
 *
 * Solution:
 *  - The FOUC-prevention script lives in <head> inside the root Server
 *    Component (app/layout.tsx), where React's client reconciler never
 *    touches it, so no warning fires.
 *  - This provider applies the theme via useEffect (DOM class manipulation)
 *    after hydration, matching exactly what next-themes does.
 *
 * Public API is intentionally compatible with next-themes so callers can
 * keep using `useTheme()` without changes; just re-import from here instead.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The stored preference ("light" | "dark" | "system"). */
  theme: Theme;
  /** The computed theme after resolving "system" → actual OS preference. */
  resolvedTheme: ResolvedTheme;
  /** The current OS preference (regardless of the stored preference). */
  systemTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  setTheme: () => {},
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "theme";
/** Cookie that the Server Component layout reads to pre-apply the class. */
const COOKIE_KEY = "theme-resolved";
const COOKIE_MAX = 60 * 60 * 24 * 365; // 1 year

function persistResolvedTheme(resolved: ResolvedTheme) {
  try {
    document.cookie = `${COOKIE_KEY}=${resolved}; path=/; max-age=${COOKIE_MAX}; SameSite=Lax`;
  } catch {
    // Blocked in some privacy modes — silently ignore.
  }
}

function applyTheme(
  resolved: ResolvedTheme,
  attribute: string,
  disableTransition: boolean,
): (() => void) | undefined {
  let cleanup: (() => void) | undefined;

  if (disableTransition) {
    const style = document.createElement("style");
    style.textContent =
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;transition:none!important}";
    document.head.appendChild(style);
    cleanup = () => {
      // Force a layout reflow so the transition suppression takes effect
      // before it's removed on the next frame.
      window.getComputedStyle(document.body);
      setTimeout(() => document.head.removeChild(style), 1);
    };
  }

  const root = document.documentElement;
  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  } else {
    root.setAttribute(attribute, resolved);
  }

  return cleanup;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({
  children,
  defaultTheme = "system",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // ── Bootstrap: read localStorage + track OS preference ──────────────────
  useEffect(() => {
    // Read stored preference
    let stored: Theme = defaultTheme;
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) || defaultTheme;
    } catch {
      // localStorage blocked (private mode, etc.)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);

    if (!enableSystem) {
      // Resolve immediately so the cookie is written on first mount.
      const resolved = stored === "system" ? "light" : (stored as ResolvedTheme);
      persistResolvedTheme(resolved);
      return;
    }

    // Track OS preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sys: ResolvedTheme = mq.matches ? "dark" : "light";
    setSystemTheme(sys);

    // Write cookie so the server has the resolved theme for the next request.
    const resolved: ResolvedTheme = stored === "system" ? sys : (stored as ResolvedTheme);
    persistResolvedTheme(resolved);

    const handler = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? "dark" : "light";
      setSystemTheme(next);
      // Keep cookie in sync when OS preference changes while the page is open.
      if (stored === "system") persistResolvedTheme(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [defaultTheme, enableSystem]);

  // ── Apply theme class whenever resolved theme changes ────────────────────
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? systemTheme : (theme as ResolvedTheme);

  useEffect(() => {
    return applyTheme(resolvedTheme, attribute, disableTransitionOnChange);
  }, [resolvedTheme, attribute, disableTransitionOnChange]);

  // ── Public setter ────────────────────────────────────────────────────────
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // ignore
      }
      // Update the server-side cookie immediately so the next hard navigation
      // (window.location.href) shows the correct theme without a flash.
      const resolved: ResolvedTheme =
        newTheme === "system" ? systemTheme : (newTheme as ResolvedTheme);
      persistResolvedTheme(resolved);
    },
    [systemTheme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
