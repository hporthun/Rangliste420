"use client";

import { useState } from "react";
import { commitImportAction, fetchM2STotalStartersAction } from "@/lib/actions/import";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import type { EntryDecision } from "@/lib/import/types";
import type { RegattaOption } from "./wizard";

type Props = {
  parsedData: ParsedRegatta;
  regattaId: string;
  regattas: RegattaOption[];
  entryDecisions: EntryDecision[];
  onDone: () => void;
  onReset: () => void;
};

export function PreviewStep({
  parsedData,
  regattaId,
  regattas,
  entryDecisions,
  onDone,
  onReset,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regatta = regattas.find((r) => r.id === regattaId);

  // Default-Auswahl für die Gesamtteilnehmerzahl in dieser Reihenfolge:
  //   1. Bereits manuell auf der Regatta gepflegter Wert (überschreibt
  //      sich beim Re-Import nicht stillschweigend selbst)
  //   2. Vom Parser ermittelter Wert (M2S API liefert die Vor-Filter-Anzahl,
  //      Paste/PDF die Anzahl im Source)
  //   3. Anzahl der geparsten Einträge als letzter Fallback
  const parsedDefault =
    parsedData.totalStarters ?? parsedData.entries.length;
  const initialTotalStarters = regatta?.totalStarters ?? parsedDefault;
  const [totalStarters, setTotalStarters] = useState<number>(initialTotalStarters);

  // Track whether the user has manually changed the value, um in der UI
  // einen Hinweis zu zeigen.
  const overridden = totalStarters !== initialTotalStarters;
  const sourceLabel =
    regatta?.totalStarters != null
      ? `bereits auf Regatta gespeichert: ${regatta.totalStarters}`
      : `vom Parser ermittelt: ${parsedDefault}`;

  // M2S-URL für Auto-Fetch der echten Gesamtzahl. Vorbelegung aus
  // regatta.sourceUrl, falls die Regatta dort verlinkt ist.
  const initialM2sUrl = regatta?.sourceUrl?.includes("manage2sail.com")
    ? regatta.sourceUrl
    : "";
  const [m2sUrl, setM2sUrl] = useState(initialM2sUrl);
  const [fetchingTotal, setFetchingTotal] = useState(false);
  const [fetchedTotal, setFetchedTotal] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleFetchTotal() {
    if (!m2sUrl) return;
    setFetchingTotal(true);
    setFetchError(null);
    setFetchedTotal(null);
    const res = await fetchM2STotalStartersAction(m2sUrl);
    setFetchingTotal(false);
    if (res.ok) {
      setFetchedTotal(res.total);
      setTotalStarters(res.total);
    } else {
      setFetchError(res.error);
    }
  }
  const newSailorsCount = entryDecisions.filter(
    (d) => d.helmDecision.type === "create"
  ).length;
  const newCrewCount = entryDecisions.filter(
    (d) => d.crewDecision.type === "create"
  ).length;

  async function handleCommit() {
    setLoading(true);
    setError(null);
    const result = await commitImportAction(
      regattaId,
      entryDecisions,
      parsedData.numRaces,
      totalStarters,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Vorschau & Import bestätigen</h2>
        <p className="text-sm text-muted-foreground">
          Bitte prüfe die Zusammenfassung. Mit &bdquo;Import bestätigen&ldquo; werden alle Einträge
          gespeichert.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-md border bg-gray-50 px-4 py-3 text-sm space-y-1">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <span className="text-muted-foreground">Regatta</span>
          <span className="font-medium">{regatta?.name ?? regattaId}</span>
          <span className="text-muted-foreground">Einträge</span>
          <span>{entryDecisions.length}</span>
          <span className="text-muted-foreground">Wettfahrten</span>
          <span>{parsedData.numRaces}</span>
          {newSailorsCount > 0 && (
            <>
              <span className="text-muted-foreground">Neue Segler (Steuermann)</span>
              <span className="text-amber-700 font-medium">{newSailorsCount}</span>
            </>
          )}
          {newCrewCount > 0 && (
            <>
              <span className="text-muted-foreground">Neue Segler (Crew)</span>
              <span className="text-amber-700 font-medium">{newCrewCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Gesamtteilnehmerzahl — wird auf der Regatta gespeichert und bestimmt
          s in der DSV-Formel R_A = f × 100 × ((s+1−x)/s).
          Default = Anzahl tatsächlich importierter Crews. Bei Auslandsregatten
          (z.B. Carnival mit 126 Booten, davon 12 Deutsche im Paste) hier den
          echten Wert eintragen, damit R_A korrekt berechnet wird. */}
      <div className="rounded-md border bg-blue-50/60 border-blue-200 px-4 py-3 space-y-2">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label htmlFor="totalStarters" className="text-sm font-medium block">
              Gesamtteilnehmerzahl der Regatta
            </label>
            <p className="text-xs text-muted-foreground">
              Anzahl aller gestarteten Boote — inkl. ausländischer Crews, die
              hier ggf. nicht als Einträge importiert werden. Wird auf die
              Regatta gespeichert und bestimmt das{" "}
              <code className="font-mono">s</code> in der DSV-Formel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="totalStarters"
              type="number"
              min={0}
              value={totalStarters}
              onChange={(e) =>
                setTotalStarters(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="input w-24 text-right font-mono"
            />
            {overridden && (
              <button
                type="button"
                onClick={() => setTotalStarters(initialTotalStarters)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
                title={sourceLabel}
              >
                ↺ {initialTotalStarters}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-blue-800">
          Default ({sourceLabel}){overridden && (
            <>
              {" "}— gesetzt auf <strong>{totalStarters}</strong>.
            </>
          )}
        </p>

        {/* Auto-Fetch über M2S API: wenn nur ein Teil der Crews im Paste war
            (z.B. nur die deutschen einer Auslandsregatta), kann hier die
            volle Anzahl direkt aus der Manage2Sail-API geholt werden. */}
        <div className="pt-2 border-t border-blue-200 space-y-2">
          <p className="text-xs font-medium text-blue-900">
            Aus Manage2Sail abrufen (vor Filterung)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={m2sUrl}
              onChange={(e) => setM2sUrl(e.target.value)}
              placeholder="https://www.manage2sail.com/de-DE/event/…#!/results?classId=…"
              className="input flex-1 min-w-[200px] text-xs"
            />
            <button
              type="button"
              onClick={handleFetchTotal}
              disabled={fetchingTotal || !m2sUrl}
              className="px-3 py-1.5 text-xs bg-white border border-blue-300 text-blue-800 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              {fetchingTotal ? "Lade…" : "Anzahl holen"}
            </button>
          </div>
          {fetchedTotal !== null && (
            <p className="text-xs text-emerald-700">
              ✓ M2S meldet <strong>{fetchedTotal}</strong> gestartete Boote in
              dieser Klasse — übernommen.
            </p>
          )}
          {fetchError && (
            <p className="text-xs text-red-600">{fetchError}</p>
          )}
        </div>
      </div>

      {/* Entry table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-10">Rk.</th>
              <th className="px-3 py-2 text-left">Segelnummer</th>
              <th className="px-3 py-2 text-left">Steuermann</th>
              <th className="px-3 py-2 text-left">Crew</th>
              <th className="px-3 py-2 text-right">Netto</th>
              <th className="px-3 py-2 text-left">Wettf.</th>
              <th className="px-3 py-2 text-center">Startgeb.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entryDecisions.map((decision, i) => {
              const entry = parsedData.entries[decision.entryIndex];
              const helmLabel =
                decision.helmDecision.type === "accept"
                  ? `${entry.helmFirstName} ${entry.helmLastName}`
                  : `★ ${decision.helmDecision.firstName} ${decision.helmDecision.lastName}`;
              const crewLabel =
                decision.crewDecision.type === "accept"
                  ? `${entry.crewFirstName ?? ""} ${entry.crewLastName ?? ""}`.trim()
                  : decision.crewDecision.type === "create"
                  ? `★ ${decision.crewDecision.firstName} ${decision.crewDecision.lastName}`
                  : "—";

              return (
                <tr key={i}>
                  <td className="px-3 py-2 text-muted-foreground">{entry.rank ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{decision.sailNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {decision.helmDecision.type === "create" ? (
                      <span className="text-amber-700">{helmLabel}</span>
                    ) : (
                      helmLabel
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {decision.crewDecision.type === "create" ? (
                      <span className="text-amber-700">{crewLabel}</span>
                    ) : (
                      crewLabel
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {decision.finalPoints ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {decision.racePoints
                      .map((rp) => {
                        const val = rp.isDiscard ? `(${rp.points})` : String(rp.points);
                        return rp.code ? `${val} ${rp.code}` : val;
                      })
                      .join(" · ")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {decision.inStartArea ? (
                      <span className="text-amber-600">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        ★ = wird als neuer Segler angelegt. Diese Segler sollten nach dem Import um
        Geburtsjahr und Geschlecht ergänzt werden.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Neu starten
        </button>
        <button
          onClick={handleCommit}
          disabled={loading}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Wird gespeichert…" : "Import bestätigen"}
        </button>
      </div>
    </div>
  );
}
