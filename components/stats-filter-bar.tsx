"use client";

/**
 * Wiederverwendbare Filter-Leiste für die Statistik-Seiten.
 * Client-Component, damit Selects auf Change sofort navigieren —
 * ohne dass der Benutzer einen "Anwenden"-Button drücken muss.
 */
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { AgeCategory, GenderCategory } from "@/lib/scoring/filters";

const AGE_OPTIONS: { value: AgeCategory; label: string }[] = [
  { value: "OPEN", label: "Alle Altersklassen" },
  { value: "U15", label: "U15" },
  { value: "U16", label: "U16" },
  { value: "U17", label: "U17" },
  { value: "U19", label: "U19" },
  { value: "U22", label: "U22" },
];

const GENDER_OPTIONS: { value: GenderCategory; label: string }[] = [
  { value: "OPEN", label: "Alle" },
  { value: "MEN", label: "Männer" },
  { value: "MIX", label: "Mix" },
  { value: "GIRLS", label: "Girls" },
];

type Props = {
  /** Path-Anteil ohne Query-String (z.B. "/statistik" oder "/statistik/aufsteiger"). */
  action?: string;
  /** Aktuell ausgewähltes Saisonjahr — bleibt beim Filterwechsel erhalten. */
  selectedYear?: number;
  selectedAge: AgeCategory;
  selectedGender: GenderCategory;
};

export function StatsFilterBar({
  action,
  selectedYear,
  selectedAge,
  selectedGender,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const targetPath = action ?? pathname;
  const hasFilter = selectedAge !== "OPEN" || selectedGender !== "OPEN";

  function navigate(name: "alter" | "gender", value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "OPEN") {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    // Year-Param bewusst nicht überschreiben — kommt aus den Search-Params.
    const qs = params.toString();
    const url = qs ? `${targetPath}?${qs}` : targetPath;
    startTransition(() => router.push(url));
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 shadow-sm transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Altersklasse</span>
        <select
          value={selectedAge}
          onChange={(e) => navigate("alter", e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Kategorie</span>
        <select
          value={selectedGender}
          onChange={(e) => navigate("gender", e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {hasFilter && (
        <Link
          href={
            selectedYear != null ? `${targetPath}?jahr=${selectedYear}` : targetPath
          }
          className="text-xs text-muted-foreground hover:text-foreground self-center"
        >
          Zurücksetzen
        </Link>
      )}
    </div>
  );
}

