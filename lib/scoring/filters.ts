/**
 * Category filters for DSV rankings.
 * Both age and gender filters apply to BOTH helm and crew.
 * Missing birthYear or gender → excluded from filtered categories.
 *
 * Age check: referenceYear - birthYear <= maxAge
 * (year-based; birth month/day not available)
 */

export type AgeCategory = "U15" | "U16" | "U17" | "U19" | "U22" | "OPEN";
export type GenderCategory = "OPEN" | "MEN" | "MIX" | "GIRLS";

type PersonData = { birthYear: number | null; gender: string | null };
type EntryData = { helm: PersonData; crew: PersonData | null };

const MAX_AGE: Record<Exclude<AgeCategory, "OPEN">, number> = {
  U15: 14,
  U16: 15,
  U17: 16,
  U19: 18,
  U22: 21,
};

/**
 * Returns true if both helm and crew satisfy the age category.
 * referenceDate.getFullYear() is used as the reference year.
 * For Jahres-/Aktuelle-Rangliste: pass new Date(seasonYear, 11, 31).
 * For IDJM: pass regatta.startDate per regatta.
 */
export function matchesAgeCategory(
  entry: EntryData,
  category: AgeCategory,
  referenceDate: Date
): boolean {
  if (category === "OPEN") return true;
  if (!entry.helm.birthYear) return false;
  if (!entry.crew || !entry.crew.birthYear) return false;

  const refYear = referenceDate.getFullYear();
  const max = MAX_AGE[category];
  return (
    refYear - entry.helm.birthYear <= max &&
    refYear - entry.crew.birthYear <= max
  );
}

/**
 * Returns true if helm and crew match the gender category.
 * "M" = male, "F" = female.
 */
export function matchesGenderCategory(
  entry: EntryData,
  category: GenderCategory
): boolean {
  if (category === "OPEN") return true;
  if (!entry.helm.gender) return false;
  if (!entry.crew || !entry.crew.gender) return false;

  const h = entry.helm.gender;
  const c = entry.crew.gender;
  switch (category) {
    case "MEN":   return h === "M" && c === "M";
    case "MIX":   return (h === "M" && c === "F") || (h === "F" && c === "M");
    case "GIRLS": return h === "F" && c === "F";
  }
}
