"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { UpdateIndicator } from "@/components/update-indicator";

const navItems = [
  { href: "/rangliste", label: "Ranglisten" },
  { href: "/regatten",  label: "Regatten"  },
];

export function PublicNav() {
  const pathname = usePathname();
  const settingsActive =
    pathname === "/einstellungen" || pathname.startsWith("/einstellungen/");
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

      <UpdateIndicator />

      <Link
        href="/einstellungen"
        title="Einstellungen — Darstellung und Benachrichtigungen"
        aria-label="Einstellungen"
        className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
          settingsActive
            ? "text-white bg-white/20"
            : "text-white/70 hover:text-white hover:bg-white/10"
        }`}
      >
        <Settings className="h-4 w-4" />
      </Link>
    </nav>
  );
}
