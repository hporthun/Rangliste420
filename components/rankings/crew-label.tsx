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
 * Map oder ist null, wird er weggelassen. Pro Crew kann zusaetzlich
 * `birthYearMissing` gesetzt sein — dann zeigt der Subtext einen
 * "ohne Jahrgang"-Badge, identisch zum Hauptsegler-Hinweis.
 */

import { MissingBirthYearBadge } from "./missing-birth-year-badge";

type Crew = {
  id: string;
  firstName: string;
  lastName: string;
  count: number;
  birthYearMissing?: boolean;
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

  // Plain-text format (used for the title attribute). JSX-Inhalt unten,
  // damit MissingBirthYearBadge inline gerendert werden kann.
  const fmtText = (c: Crew) => {
    const by = birthYearMap?.get(c.id);
    const base = by != null ? `${c.firstName} ${c.lastName}, Jg. ${by}` : `${c.firstName} ${c.lastName}`;
    return c.birthYearMissing ? `${base} (ohne Jahrgang)` : base;
  };

  const renderOne = (c: Crew) => {
    const by = birthYearMap?.get(c.id);
    return (
      <>
        {c.firstName} {c.lastName}
        {by != null && <>, Jg.&nbsp;{by}</>}
        {c.birthYearMissing && <MissingBirthYearBadge />}
      </>
    );
  };

  let content;
  if (crews.length === 1) {
    content = renderOne(crews[0]);
  } else if (crews.length === 2) {
    content = (
      <>
        {renderOne(crews[0])} · {renderOne(crews[1])}
      </>
    );
  } else {
    content = (
      <>
        {renderOne(crews[0])} + {crews.length - 1} weitere
      </>
    );
  }

  return (
    <span
      className={`block text-xs text-muted-foreground mt-0.5 ${className}`}
      title={crews.map(fmtText).join(", ")}
    >
      {prefix}: {content}
    </span>
  );
}
