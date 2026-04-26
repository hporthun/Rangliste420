"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/segler",     label: "Segler",     tour: "nav-segler"     },
  { href: "/admin/regatten",   label: "Regatten",   tour: "nav-regatten"   },
  { href: "/admin/ranglisten", label: "Ranglisten", tour: "nav-ranglisten" },
  { href: "/admin/wartung",    label: "Wartung",    tour: "nav-wartung"    },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
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
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        active
          ? "text-white bg-white/20 font-medium"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      Hilfe
    </Link>
  );
}
