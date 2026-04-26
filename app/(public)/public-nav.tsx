"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/rangliste", label: "Ranglisten" },
  { href: "/regatten", label: "Regatten" },
];

export function PublicNav() {
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
