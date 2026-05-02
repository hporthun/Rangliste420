"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = { href: string; label: string; tour: string; adminOnly?: boolean };

const navItems: NavItem[] = [
  { href: "/admin/segler",     label: "Segler",     tour: "nav-segler"     },
  { href: "/admin/regatten",   label: "Regatten",   tour: "nav-regatten"   },
  { href: "/admin/ranglisten", label: "Ranglisten", tour: "nav-ranglisten" },
  { href: "/admin/wartung",    label: "Wartung",    tour: "nav-wartung",    adminOnly: true },
  { href: "/admin/benutzer",   label: "Benutzer",   tour: "nav-benutzer",   adminOnly: true },
];

function visibleItems(role: string | undefined): NavItem[] {
  return role === "ADMIN" ? navItems : navItems.filter((i) => !i.adminOnly);
}

/**
 * Inline navigation bar for the admin header. Visible from `md` upwards.
 * On smaller viewports, use {@link AdminMobileMenu} instead — it overlays a
 * full-screen sheet that contains the nav links + Hilfe.
 */
export function AdminNav({ role }: { role?: string }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex gap-1">
      {visibleItems(role).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tour}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              active
                ? "text-white bg-white/20 font-medium"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HilfeLink() {
  const pathname = usePathname();
  const active = pathname === "/admin/hilfe" || pathname.startsWith("/admin/hilfe/");
  return (
    <Link
      href="/admin/hilfe"
      data-tour="nav-hilfe"
      className={`hidden md:inline-flex px-3 py-1.5 text-sm rounded-md transition-colors ${
        active
          ? "text-white bg-white/20 font-medium"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      Hilfe
    </Link>
  );
}

/**
 * Hamburger-triggered overlay menu visible below `md`. Lists the same nav
 * items as {@link AdminNav}, plus the Hilfe link, in a single column.
 */
export function AdminMobileMenu({ role }: { role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menü schließen"
            className="fixed inset-0 top-14 z-40 bg-black/30 backdrop-blur-sm"
          />
          {/* Sheet */}
          <nav
            className="fixed left-0 right-0 top-14 z-50 border-b border-white/10 shadow-xl"
            style={{
              background:
                "linear-gradient(160deg, oklch(0.175 0.095 248) 0%, oklch(0.245 0.088 238) 55%, oklch(0.30 0.08 228) 100%)",
            }}
          >
            <ul className="flex flex-col py-2">
              {[
                ...visibleItems(role),
                { href: "/admin/hilfe", label: "Hilfe", tour: "nav-hilfe" } as NavItem,
              ].map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-tour={item.tour}
                      className={`block px-5 py-3 text-sm transition-colors ${
                        active
                          ? "text-white bg-white/15 font-medium"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
