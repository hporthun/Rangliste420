"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";

export type RegattaItem = {
  id: string;
  name: string;
  startDate: string; // ISO string
  completedRaces: number;
  resultCount: number;
};

type Props = {
  regattas: RegattaItem[];
  selectedIds: string[];
};

/**
 * Client-side filtered checkbox list for JWM/JEM regatta selection.
 *
 * All checkboxes stay in the DOM (only hidden via CSS) so that already-checked
 * regattas are still submitted with the GET form even when the filter hides them.
 */
export function RegattaFilterList({ regattas, selectedIds }: Props) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Derive unique years from regatta list, newest first
  const years = useMemo(() => {
    const ys = new Set(regattas.map((r) => new Date(r.startDate).getFullYear()));
    return [...ys].sort((a, b) => b - a);
  }, [regattas]);

  // Set of regatta IDs that match the current filter
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return new Set(
      regattas
        .filter((r) => {
          if (yearFilter !== "all") {
            const year = new Date(r.startDate).getFullYear();
            if (year !== parseInt(yearFilter, 10)) return false;
          }
          if (q && !r.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .map((r) => r.id),
    );
  }, [regattas, yearFilter, search]);

  const visibleCount = visibleIds.size;
  const hasFilter = yearFilter !== "all" || search !== "";

  function reset() {
    setYearFilter("all");
    setSearch("");
  }

  return (
    <div className="space-y-2">
      {/* Filter bar — inputs have no `name` so they're not submitted with the form */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="all">Alle Jahre</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-36">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name suchen…"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 pr-7 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Suche löschen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:underline"
          >
            Zurücksetzen
          </button>
        )}
      </div>

      {/* Checkbox list — all entries rendered, non-matching visually hidden */}
      <div className="max-h-64 overflow-y-auto border rounded-md divide-y bg-white">
        {regattas.map((reg) => {
          const visible = visibleIds.has(reg.id);
          const checked = selectedIds.includes(reg.id);
          return (
            <label
              key={reg.id}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer${visible ? "" : " hidden"}`}
            >
              <input
                type="checkbox"
                name="regattas"
                value={reg.id}
                defaultChecked={checked}
                className="rounded border-gray-300"
              />
              <span className="flex-1 text-sm">
                <span className="font-medium">{reg.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(reg.startDate).toLocaleDateString("de-DE")} ·{" "}
                  {reg.resultCount} Einträge
                </span>
              </span>
            </label>
          );
        })}

        {visibleCount === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            Keine Regatten gefunden.
          </p>
        )}
      </div>

      {hasFilter && visibleCount > 0 && visibleCount < regattas.length && (
        <p className="text-xs text-muted-foreground">
          {visibleCount} von {regattas.length} Regatten
        </p>
      )}
    </div>
  );
}
