import { StammdatenImport } from "./stammdaten-import";
import { StammdatenCsvImport } from "./stammdaten-csv-import";

export default function StammdatenImportPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Stammdaten-Import</h1>
      </div>

      {/* CSV import (Seglerdaten_JJJJ.csv) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">CSV-Format (Seglerdaten_JJJJ.csv)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spaltenfolge:{" "}
            <code className="bg-muted px-1 rounded text-xs">Name · Vorname · Geburtsjahr</code>
            {" "}(kommagetrennt). Bekannte Segler werden per Fuzzy-Matching zugeordnet,
            unbekannte können direkt neu angelegt werden.
          </p>
        </div>
        <StammdatenCsvImport />
      </section>

      <hr className="border-border" />

      {/* Tab-separated legacy import */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Tab-Format (Datenbank-Export)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tabelleninhalt einfügen:{" "}
            <code className="bg-muted px-1 rounded text-xs">id · Nachname · Vorname · Geburtsjahr · Geschlecht</code>
            {" "}(Tab-getrennt). Felder werden nur gesetzt wenn aktuell leer.
          </p>
        </div>
        <StammdatenImport />
      </section>
    </div>
  );
}
