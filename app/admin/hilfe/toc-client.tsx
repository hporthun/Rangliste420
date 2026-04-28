"use client";

import { useEffect, useState } from "react";

export type TocEntry = {
  id: string;
  label: string;
  level: number;
  /** Pre-computed chapter number (e.g. "1.", "2.3"). Optional. */
  num?: string;
};

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
          className={`flex items-baseline gap-2 text-sm py-0.5 transition-colors rounded px-2 ${
            e.level === 2 ? "pl-4 text-xs" : ""
          } ${
            active === e.id
              ? "text-foreground font-medium bg-muted"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {e.num && (
            <span className="tabular-nums shrink-0 opacity-60 w-7 text-right">
              {e.num}
            </span>
          )}
          <span className="truncate">{e.label}</span>
        </a>
      ))}
    </nav>
  );
}
