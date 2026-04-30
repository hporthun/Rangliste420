/**
 * Parser für das einfache CSV-Stammdatenformat (Seglerdaten_JJJJ.csv).
 *
 * Spaltenfolge: Name (Nachname), Vorname, Geburtsjahr
 * Trennzeichen: Komma. Keine Anführungszeichen um Werte.
 * Header-Zeile wird automatisch übersprungen (erste Spalte = "Name" / "Nachname").
 *
 * Duplikate (gleicher Vor- + Nachname + gleiches Geburtsjahr) werden dedupliziert.
 * Gleicher Name mit UNTERSCHIEDLICHEM Geburtsjahr wird als separate Zeile behalten
 * (könnten zwei verschiedene Personen sein — Admin entscheidet).
 */

export type StammdatenCsvRow = {
  /** 0-based index in der deduplizierten Liste, dient als React-Key */
  idx: number;
  lastName: string;
  firstName: string;
  birthYear: number | null;
  /** Mehrfach im CSV: gleicher Name, unterschiedliches Geburtsjahr */
  duplicateName: boolean;
};

export function parseStammdatenCsv(text: string): StammdatenCsvRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter(Boolean);

  const seen = new Set<string>(); // key: lastName|firstName|birthYear
  const nameCount = new Map<string, number>(); // key: lastName|firstName

  const rows: StammdatenCsvRow[] = [];

  for (const line of lines) {
    // Simple split — format has no quoted commas
    const cols = line.split(",");
    if (cols.length < 2) continue;

    const lastName = cols[0].trim();
    const firstName = cols[1].trim();
    const birthYearRaw = (cols[2] ?? "").trim();

    // Skip header row
    if (lastName.toLowerCase() === "name" || lastName.toLowerCase() === "nachname") continue;
    if (!lastName || !firstName) continue;

    const birthYear =
      birthYearRaw && /^\d{4}$/.test(birthYearRaw)
        ? parseInt(birthYearRaw, 10)
        : null;

    // Exact-duplicate check (same name + same year)
    const exactKey = `${lastName}|${firstName}|${birthYear ?? ""}`;
    if (seen.has(exactKey)) continue;
    seen.add(exactKey);

    // Track how many distinct years exist for each name
    const nameKey = `${lastName}|${firstName}`;
    nameCount.set(nameKey, (nameCount.get(nameKey) ?? 0) + 1);

    rows.push({ idx: rows.length, lastName, firstName, birthYear, duplicateName: false });
  }

  // Mark rows whose name appears more than once (different birth years)
  return rows.map((r) => ({
    ...r,
    duplicateName: (nameCount.get(`${r.lastName}|${r.firstName}`) ?? 1) > 1,
  }));
}
