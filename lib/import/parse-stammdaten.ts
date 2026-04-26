export type StammdatenRow = {
  externalId: number;
  lastName: string;
  firstName: string;
  birthYear: number | null;
  gender: "M" | "F" | null;
};

/**
 * Parses tab-separated stammdaten export.
 * Expected columns: id  lastName  firstName  birthYear  gender  createdAt  updatedAt
 * birthYear may be "NULL"; gender is "male"/"female".
 */
export function parseStammdaten(text: string): StammdatenRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const cols = line.split("\t");
      if (cols.length < 5) return [];
      const [idStr, lastName, firstName, birthYearStr, genderStr] = cols;
      const externalId = parseInt(idStr, 10);
      if (isNaN(externalId)) return [];
      const birthYear =
        birthYearStr === "NULL" || !birthYearStr.trim()
          ? null
          : parseInt(birthYearStr, 10) || null;
      const gender: "M" | "F" | null =
        genderStr?.trim() === "male"
          ? "M"
          : genderStr?.trim() === "female"
          ? "F"
          : null;
      return [{ externalId, lastName: lastName.trim(), firstName: firstName.trim(), birthYear, gender }];
    });
}
