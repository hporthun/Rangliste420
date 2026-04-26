import { StammdatenImport } from "./stammdaten-import";

export default function StammdatenImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Stammdaten-Import (Geburtsjahr & Geschlecht)</h1>
      <p className="text-sm text-muted-foreground">
        Tabelleninhalt einfügen: <code className="bg-muted px-1 rounded text-xs">id · Nachname · Vorname · Geburtsjahr · Geschlecht · ...</code>
        (Tab-getrennt). Felder werden nur gesetzt wenn aktuell leer.
      </p>
      <StammdatenImport />
    </div>
  );
}
