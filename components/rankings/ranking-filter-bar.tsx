"use client";

import { useRouter, usePathname } from "next/navigation";

const AGE_OPTIONS = [
  { value: "", label: "Alle Altersklassen" },
  { value: "U22", label: "U22" },
  { value: "U19", label: "U19" },
  { value: "U17", label: "U17" },
  { value: "U16", label: "U16" },
  { value: "U15", label: "U15" },
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Alle Kategorien" },
  { value: "OPEN", label: "Open" },
  { value: "GIRLS", label: "Mädchen" },
  { value: "MIX", label: "Mix" },
  { value: "MEN", label: "Jungen" },
] as const;

type Props = {
  currentAge: string;
  currentGender: string;
};

export function RankingFilterBar({ currentAge, currentGender }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(age: string, gender: string) {
    const params = new URLSearchParams();
    if (age) params.set("age", age);
    if (gender) params.set("gender", gender);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const isFiltered = !!(currentAge || currentGender);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground font-medium">Filter:</span>
      <select
        value={currentAge}
        onChange={(e) => navigate(e.target.value, currentGender)}
        className="border rounded px-2 py-1 bg-background text-foreground hover:border-foreground/40 transition-colors cursor-pointer text-xs"
      >
        {AGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={currentGender}
        onChange={(e) => navigate(currentAge, e.target.value)}
        className="border rounded px-2 py-1 bg-background text-foreground hover:border-foreground/40 transition-colors cursor-pointer text-xs"
      >
        {GENDER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isFiltered && (
        <button
          onClick={() => navigate("", "")}
          className="text-muted-foreground hover:text-foreground transition-colors underline"
        >
          zurücksetzen
        </button>
      )}
    </div>
  );
}
