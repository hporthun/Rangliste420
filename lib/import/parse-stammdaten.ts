export type StammdatenRow = {
  externalId: number;
  lastName: string;
  firstName: string;
  birthYear: number | null;
  gender: "M" | "F" | null;
};

/**
 * Strip surrounding double quotes from a field if present, then trim
 * whitespace. Used to support PostgreSQL COPY-style exports where every
 * value is wrapped in `"..."`.
 *
 * @example
 *   unquote('"Akerson besier"') === "Akerson besier"
 *   unquote("Akerson besier")   === "Akerson besier"  (no quotes → unchanged)
 */
function unquote(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Returns true if the value should be interpreted as NULL.
 *
 * Recognises three conventions:
 *   - empty string (legacy)
 *   - "NULL"      (legacy / SQL textual)
 *   - "\\N"       (PostgreSQL COPY default)
 */
function isNull(s: string): boolean {
  const t = s.trim();
  return t === "" || t === "NULL" || t === "\\N";
}

/**
 * Parses tab-separated Stammdaten export.
 *
 * Supported column order (legacy and new):
 *   id  lastName  firstName  birthYear  gender  [createdAt]  [updatedAt]
 *
 * Both raw tab-separated and PostgreSQL COPY-style (each cell wrapped in
 * double quotes, `\N` used for NULL) are accepted — every cell is run
 * through {@link unquote} and {@link isNull} before further parsing.
 *
 * @example
 *   744\tAkerson besier\tJohanna\tNULL\tfemale       (legacy)
 *   "744"\t"Akerson besier"\t"Johanna"\t\\N\t"female" (Postgres COPY)
 */
export function parseStammdaten(text: string): StammdatenRow[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\r$/, "")) // strip trailing CR (Windows pastes)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const rawCols = line.split("\t");
      if (rawCols.length < 5) return [];

      const [idRaw, lastNameRaw, firstNameRaw, birthYearRaw, genderRaw] = rawCols;

      const idStr = unquote(idRaw);
      const lastName = unquote(lastNameRaw);
      const firstName = unquote(firstNameRaw);
      const birthYearStr = unquote(birthYearRaw);
      const genderStr = unquote(genderRaw).toLowerCase();

      const externalId = parseInt(idStr, 10);
      if (isNaN(externalId)) return [];

      const birthYear = isNull(birthYearStr)
        ? null
        : parseInt(birthYearStr, 10) || null;

      const gender: "M" | "F" | null = isNull(genderStr)
        ? null
        : genderStr === "male" || genderStr === "m"
        ? "M"
        : genderStr === "female" || genderStr === "f"
        ? "F"
        : null;

      return [{ externalId, lastName, firstName, birthYear, gender }];
    });
}
