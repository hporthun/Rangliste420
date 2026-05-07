import type { AgeCategory, GenderCategory } from "@/lib/scoring/filters";

/**
 * Parsed-and-defaulted Filter aus den Query-Params.
 *
 * Bewusst in einer eigenen Datei (statt in components/stats-filter-bar.tsx),
 * damit Server-Components diese Funktion importieren können — die Filter-Bar
 * selbst ist eine Client-Component ("use client") und exportiert keine
 * Helfer mehr, die vom Server aufgerufen werden.
 */
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
