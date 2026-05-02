/**
 * Hinweis-Badge in Rang-/Quallisten: kennzeichnet Segler ohne gepflegtes
 * Geburtsjahr. Solche Segler erscheinen nur in OPEN-Ranglisten — in
 * Altersklassen-Filtern werden sie ausgeschlossen (siehe CLAUDE.md
 * „Optionale Stammdaten").
 */
export function MissingBirthYearBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle ${className}`}
      title="Geburtsjahr fehlt — bitte in den Stammdaten ergänzen, sonst erscheint der Segler nicht in Altersklassen-Ranglisten."
    >
      ohne Jahrgang
    </span>
  );
}
