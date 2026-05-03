"use client";

/**
 * Suchfeld fuer Ranglisten-Detailseiten. Liest beim Tippen alle Elemente
 * im Dokument mit `data-search`-Attribut und blendet die nicht-passenden
 * via inline `display:none` aus. Damit bleiben die Server-rendered
 * Tabellen unveraendert — die page.tsx setzt das Attribut auf jeder
 * `<tr>` mit den durchsuchbaren Token (Helm-Name, Crew-Namen, Verein).
 *
 * Normalisierung: Diakritika werden entfernt, sodass "Sigge" auch
 * "Šigge" findet und "Mueller" matchen kann auf "Müller".
 */

import { useEffect, useState } from "react";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

export function RankingsSearch() {
  const [q, setQ] = useState("");

  useEffect(() => {
    const needle = normalize(q.trim());
    const rows = document.querySelectorAll<HTMLElement>("[data-search]");
    let visibleCount = 0;
    rows.forEach((el) => {
      const haystack = normalize(el.dataset.search ?? "");
      const match = !needle || haystack.includes(needle);
      el.style.display = match ? "" : "none";
      if (match) visibleCount++;
    });

    // Sektionen ohne Treffer komplett ausblenden, aber nur wenn ein
    // Suchbegriff aktiv ist — sonst stoeren wir die Initial-Ansicht nicht.
    document.querySelectorAll<HTMLElement>("[data-search-section]").forEach((sec) => {
      if (!needle) {
        sec.style.display = "";
        return;
      }
      const visible = sec.querySelectorAll<HTMLElement>("[data-search]");
      let any = false;
      visible.forEach((r) => {
        if (r.style.display !== "none") any = true;
      });
      sec.style.display = any ? "" : "none";
    });

    // "Keine Treffer"-Hinweis ein-/ausblenden
    const empty = document.getElementById("rankings-search-empty");
    if (empty) {
      empty.style.display = needle && visibleCount === 0 ? "" : "none";
    }
  }, [q]);

  return (
    <div className="space-y-1">
      <label htmlFor="rankings-search" className="sr-only">
        Suche
      </label>
      <div className="relative">
        <input
          id="rankings-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, Crew oder Verein..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          autoComplete="off"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            aria-label="Suche loeschen"
          >
            ✕
          </button>
        )}
      </div>
      <p
        id="rankings-search-empty"
        className="text-xs text-muted-foreground"
        style={{ display: "none" }}
      >
        Keine Segler gefunden.
      </p>
    </div>
  );
}
