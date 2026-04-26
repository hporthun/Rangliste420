"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Settings2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  username: string;
  email: string;
  signOutAction: () => Promise<void>;
};

export function AdminUserMenu({ username, email, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const displayName = username || email || "Admin";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
          open
            ? "bg-white/20 text-white"
            : "text-white/70 hover:text-white hover:bg-white/10"
        }`}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/25 text-white font-bold text-xs select-none shrink-0">
          {initial}
        </span>
        <span className="hidden sm:block max-w-32 truncate">{displayName}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-72 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/40">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0 select-none">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {email && email !== displayName && (
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              )}
            </div>
          </div>

          {/* Theme */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Darstellung
            </p>
            <ThemeToggle variant="panel" />
          </div>

          {/* Actions */}
          <div className="p-1.5 space-y-0.5">
            <Link
              href="/admin/konto"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-muted transition-colors w-full"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Konto-Einstellungen</span>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors w-full text-left"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
