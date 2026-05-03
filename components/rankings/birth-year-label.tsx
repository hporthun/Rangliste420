/**
 * Kleiner Subtext "Jg. 2009" neben dem Seglernamen. Wird ausschliesslich
 * fuer angemeldete Benutzer gerendert; die Page-Ebene liefert deshalb
 * `birthYear === null` (oder den Wert) erst nach Session-Check, sodass das
 * Geburtsjahr nicht in den RSC-Payload anonymer Aufrufe gelangt.
 */
export function BirthYearLabel({ birthYear }: { birthYear: number | null | undefined }) {
  if (birthYear == null) return null;
  return (
    <span
      className="inline-block ml-1.5 text-[10px] font-normal text-muted-foreground tabular-nums align-middle"
      title="Geburtsjahr (nur fuer angemeldete Benutzer sichtbar)"
    >
      Jg.&nbsp;{birthYear}
    </span>
  );
}
