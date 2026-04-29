"use client";

import { useState } from "react";
import { commitImportAction } from "@/lib/actions/import";
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
      parsedData.totalStarters,
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
