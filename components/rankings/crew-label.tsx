/**
 * Renders a compact crew label for ranking tables.
 *
 * Issue #31: rankings list one line per helm; the crew partner used to be
 * invisible (it only showed up on the detail page). This component keeps the
 * helm name as the visual focus but adds a small subtitle with the crew
 * name(s):
 *
 *   - 1 crew  → "Crew: Max Mustermann"
 *   - 2 crews → "Crew: Max Mustermann · Anna Beispiel"
 *   - 3+      → "Crew: Max Mustermann + 2 weitere"
 *   - 0 (PDF imports w/ unknown crew) → renders nothing
 *
 * Pure presentational, no auth or DB access. Wenn ein `birthYearMap`
 * uebergeben wird (nur fuer angemeldete Benutzer), wird der Jahrgang
 * ", Jg. 2009" hinter jedem Namen ergaenzt — fehlt der Eintrag in der
 * Map oder ist null, wird er weggelassen.
 */
type Crew = {
  id: string;
  firstName: string;
  lastName: string;
  count: number;
};

export function CrewLabel({
  crews,
  prefix = "Crew",
  className = "",
  birthYearMap,
}: {
  crews: Crew[];
  /** Label shown before the name(s). Use "Steuermann" in CREW-mode rankings. */
  prefix?: string;
  className?: string;
  /** Optional: Jahrgang pro Sailor-Id. Nur gefuellt fuer angemeldete Benutzer. */
  birthYearMap?: Map<string, number | null>;
}) {
  if (!crews.length) return null;

  const fmt = (c: Crew) => {
    const by = birthYearMap?.get(c.id);
    return by != null ? `${c.firstName} ${c.lastName}, Jg. ${by}` : `${c.firstName} ${c.lastName}`;
  };
  let label: string;
  if (crews.length === 1) {
    label = fmt(crews[0]);
  } else if (crews.length === 2) {
    label = `${fmt(crews[0])} · ${fmt(crews[1])}`;
  } else {
    label = `${fmt(crews[0])} + ${crews.length - 1} weitere`;
  }

  return (
    <span
      className={`block text-xs text-muted-foreground mt-0.5 ${className}`}
      title={crews.map(fmt).join(", ")}
    >
      {prefix}: {label}
    </span>
  );
}
