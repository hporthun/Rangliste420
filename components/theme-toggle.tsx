"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

const options = [
  { value: "light",  label: "Hell",   Icon: Sun },
  { value: "dark",   label: "Dunkel", Icon: Moon },
  { value: "system", label: "Auto",   Icon: Monitor },
] as const;

/**
 * Kompakter Hell / Dunkel / Auto Umschalter.
 * Kann auf hellem und dunklem Hintergrund eingesetzt werden.
 *
 * Props:
 *   variant="header"  → weiße Icons (für den dunklen Admin-Header)
 *   variant="panel"   → Standardfarben (für helle Einstellungsseiten)
 */
export function ThemeToggle({
  variant = "panel",
}: {
  variant?: "header" | "panel";
}) {
  const { theme, setTheme } = useTheme();
  // Verhindert Hydration-Mismatch: erst nach Hydration rendern
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Platzhalter gleicher Größe – kein Layout-Sprung
    return <div className="h-8 w-[152px] rounded-md" />;
  }

  if (variant === "header") {
    // Kompakt für den dunklen Header – nur Icons mit Tooltip-ähnlichem Label
    return (
      <div className="flex items-center gap-0.5">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
              theme === value
                ? "bg-white/20 text-white font-medium"
                : "text-white/50 hover:text-white hover:bg-white/10"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Panel-Variante: volle Breite, mit Label
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
            theme === value
              ? "bg-background text-foreground shadow font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
