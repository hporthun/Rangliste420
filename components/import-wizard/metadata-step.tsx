"use client";

import { useState } from "react";
import Link from "next/link";
import type { RegattaOption } from "./wizard";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";

type Props = {
  regattas: RegattaOption[];
  parsedData: ParsedRegatta;
  initialRegattaId?: string;
  onComplete: (regattaId: string) => void;
  onBack: () => void;
};

export function MetadataStep({ regattas, parsedData, initialRegattaId, onComplete, onBack }: Props) {
  const [selectedId, setSelectedId] = useState(
    initialRegattaId ?? regattas[0]?.id ?? ""
  );

  const selected = regattas.find((r) => r.id === selectedId);

  function handleSubmit() {
    if (!selectedId) return;
    onComplete(selectedId);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Regatta zuordnen</h2>
        <p className="text-sm text-muted-foreground">
          Geparst: {parsedData.entries.length} Einträge, {parsedData.numRaces} Wettfahrten.
          Wähle die Regatta, zu der diese Ergebnisse gehören.
        </p>
      </div>

      {regattas.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Keine Regatten vorhanden.{" "}
          <Link href="/admin/regatten/neu" className="underline font-medium">
            Regatta anlegen →
          </Link>{" "}
          und danach zurückkehren.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Regatta</label>
            <select
              className="input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {regattas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({new Date(r.startDate).toLocaleDateString("de-DE")})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-md border bg-gray-50 px-4 py-3 text-sm space-y-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span className="text-muted-foreground">Regatta</span>
                <span className="font-medium">{selected.name}</span>
                <span className="text-muted-foreground">Datum</span>
                <span>{new Date(selected.startDate).toLocaleDateString("de-DE")}</span>
                <span className="text-muted-foreground">Wettfahrten</span>
                <span>{selected.completedRaces}</span>
                <span className="text-muted-foreground">Ranglistenfaktor f</span>
                <span>{selected.ranglistenFaktor.toFixed(2)}</span>
              </div>
              {selected.completedRaces !== parsedData.numRaces && (
                <p className="text-amber-700 text-xs mt-2 border-t border-amber-200 pt-2">
                  Hinweis: Regatta hat {selected.completedRaces} Wettfahrten eingetragen,
                  aber {parsedData.numRaces} wurden geparst. Bitte prüfen.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Regatta nicht in der Liste?{" "}
            <Link href="/admin/regatten/neu" className="text-blue-600 hover:underline">
              Neue Regatta anlegen
            </Link>{" "}
            und dann zurückkehren.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ← Zurück
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedId}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}
