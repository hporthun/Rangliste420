/**
 * Parses the tab-separated regatta list format copied from the DSV ranking calendar.
 *
 * Expected columns (tab-separated):
 *   DD.MM.YYYY - DD.MM.YYYY  |  Name  |  Class  |  Country  |  Factor (1,20)  |  Races
 *
 * Example:
 *   12.02.2026 - 15.02.2026\tCarnival Race 2026\t420\tGER\t1,20\t5
 */

export type ParsedRegattaRow = {
  startDate: string;   // ISO: YYYY-MM-DD
  endDate: string;     // ISO: YYYY-MM-DD
  numDays: number;
  name: string;
  country: string;     // e.g. "GER"
  ranglistenFaktor: number;
  completedRaces: number;
  /** Auto-suggested: true when numDays >= 3 */
  multiDayAnnouncement: boolean;
};

export type ParseRegattaListResult = {
  rows: ParsedRegattaRow[];
  skipped: number;
};

function parseGermanDate(s: string): string | null {
  // DD.MM.YYYY → YYYY-MM-DD
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseRegattaList(text: string): ParseRegattaListResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRegattaRow[] = [];
  let skipped = 0;

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 6) { skipped++; continue; }

    const [datePart, namePart, , countryPart, factorPart, racesPart] = cols;

    // Parse date range: "DD.MM.YYYY - DD.MM.YYYY"
    const dateParts = datePart.split("-").map((s) => s.trim());
    if (dateParts.length < 2) { skipped++; continue; }
    const startDate = parseGermanDate(dateParts[0]);
    // End date: last token that looks like a date
    const endDate = parseGermanDate(dateParts[dateParts.length - 1]);
    if (!startDate || !endDate) { skipped++; continue; }

    // Factor: German decimal (comma → dot)
    const ranglistenFaktor = parseFloat(factorPart.trim().replace(",", "."));
    if (isNaN(ranglistenFaktor)) { skipped++; continue; }

    const completedRaces = parseInt(racesPart.trim(), 10);
    if (isNaN(completedRaces)) { skipped++; continue; }

    const name = namePart.trim();
    if (!name) { skipped++; continue; }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const numDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    rows.push({
      startDate,
      endDate,
      numDays,
      name,
      country: (countryPart?.trim() || "GER").toUpperCase(),
      ranglistenFaktor,
      completedRaces,
      multiDayAnnouncement: numDays >= 3,
    });
  }

  return { rows, skipped };
}
