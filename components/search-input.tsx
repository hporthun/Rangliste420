"use client";

import { useRef, useState } from "react";
import { Search, X } from "lucide-react";

interface Props {
  placeholder?: string;
  /** URL-Query-Parameter-Name, default "q" */
  paramName?: string;
  /** Initial value – read from server so the field is pre-filled on page load */
  initialValue?: string;
}

/**
 * Live-Suchfeld – aktualisiert den URL-Query-Parameter nach 400 ms Debounce.
 * Alle anderen aktuellen Query-Parameter (z. B. "year") bleiben erhalten.
 * Nutzt window.location statt useSearchParams, benötigt kein Suspense.
 */
export function SearchInput({
  placeholder = "Suchen…",
  paramName = "q",
  initialValue = "",
}: Props) {
  const [value, setValue] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(val: string) {
    // Read live URL to preserve other params (e.g. year)
    const params = new URLSearchParams(window.location.search);
    if (val.trim()) {
      params.set(paramName, val.trim());
    } else {
      params.delete(paramName);
    }
    // Full navigation — guarantees RSC re-render regardless of router cache
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(val), 400);
  }

  function handleClear() {
    setValue("");
    if (timer.current) clearTimeout(timer.current);
    navigate("");
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-9 w-52 rounded-md border pl-8 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Suche löschen"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
