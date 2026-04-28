"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/rangliste", label: "Ranglisten" },
  { href: "/regatten",  label: "Regatten"  },
];

const CYCLE = ["system", "light", "dark"] as const;
type ThemeOption = (typeof CYCLE)[number];

const ICON: Record<ThemeOption, React.ReactNode> = {
  system: <Monitor className="h-4 w-4" />,
  light:  <Sun     className="h-4 w-4" />,
  dark:   <Moon    className="h-4 w-4" />,
};

const LABEL: Record<ThemeOption, string> = {
  system: "System",
  light:  "Hell",
  dark:   "Dunkel",
};

function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const current = (CYCLE.includes(theme as ThemeOption) ? theme : "system") as ThemeOption;

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setTheme(next);
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABEL[current]} – klicken zum Wechseln`}
      aria-label={`Farbschema wechseln (aktuell: ${LABEL[current]})`}
      className="flex items-center justify-center w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      {ICON[current]}
    </button>
  );
}

export function PublicNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 ml-auto">
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
              active
                ? "text-white bg-white/20 font-medium"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <div className="w-px h-4 bg-white/20 mx-1" />

      <ThemeCycleButton />
    </nav>
  );
}
