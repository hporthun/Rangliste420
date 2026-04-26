"use client";

import { useEffect, useState } from "react";

type TocEntry = { id: string; label: string; level: number };

export function TocNav({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const els = entries.map((e) => document.getElementById(e.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.filter((o) => o.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav className="space-y-0.5">
      {entries.map((e) => (
        <a
          key={e.id}
          href={`#${e.id}`}
          className={`block text-sm py-0.5 transition-colors rounded px-2 ${
            e.level === 2 ? "pl-4 text-xs" : ""
          } ${
            active === e.id
              ? "text-foreground font-medium bg-muted"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {e.label}
        </a>
      ))}
    </nav>
  );
}
