/**
 * Wiederverwendbare Filter-Leiste für die Statistik-Seiten.
 * Reine Server-Component — Form-Submit per GET führt zu Re-Render mit
 * neuen Query-Params. Kein Client-JS.
 */
import Link from "next/link";
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
  /** Form-Action-Pfad (z.B. "/statistik" oder "/statistik/aufsteiger"). */
  action: string;
  /** Aktuell ausgewähltes Saisonjahr — wird als hidden input weitergegeben. */
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
  const hasFilter = selectedAge !== "OPEN" || selectedGender !== "OPEN";
  return (
    <form
      method="GET"
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3 shadow-sm"
    >
      {selectedYear != null && (
        <input type="hidden" name="jahr" value={selectedYear} />
      )}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Altersklasse</span>
        <select
          name="alter"
          defaultValue={selectedAge}
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
          name="gender"
          defaultValue={selectedGender}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Anwenden
      </button>
      {hasFilter && (
        <Link
          href={
            selectedYear != null ? `${action}?jahr=${selectedYear}` : action
          }
          className="text-xs text-muted-foreground hover:text-foreground self-center"
        >
          Zurücksetzen
        </Link>
      )}
    </form>
  );
}

/** Parsed-and-defaulted Filter aus den Query-Params. */
export function parseFilterParams(params: {
  alter?: string;
  gender?: string;
}): { age: AgeCategory; gender: GenderCategory } {
  const ageRaw = params.alter as AgeCategory | undefined;
  const genderRaw = params.gender as GenderCategory | undefined;
  const validAge = new Set<AgeCategory>(["OPEN", "U15", "U16", "U17", "U19", "U22"]);
  const validGender = new Set<GenderCategory>(["OPEN", "MEN", "MIX", "GIRLS"]);
  return {
    age: ageRaw && validAge.has(ageRaw) ? ageRaw : "OPEN",
    gender: genderRaw && validGender.has(genderRaw) ? genderRaw : "OPEN",
  };
}
