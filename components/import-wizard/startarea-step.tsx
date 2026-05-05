"use client";

import { useState } from "react";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import { IN_START_AREA_CODES } from "@/lib/import/pdf-utils";

type Props = {
  parsedData: ParsedRegatta;
  onComplete: (inStartAreaMap: Record<number, boolean>) => void;
  onBack: () => void;
};

// Lokales Alias auf die einzig wahre Quelle (Issue #60). Wir brauchen den
// Set hier zweifach: Default-Vorbelegung der Checkbox UND
// Badge-Highlighting im Codes-Spalten-Renderer.
const IN_START_CODES = IN_START_AREA_CODES;

function getSuggestedInStartArea(entry: ParsedRegatta["entries"][number]): boolean {
  return entry.raceScores.some((s) => IN_START_CODES.has(s.code ?? ""));
}

function getPenaltyCodes(entry: ParsedRegatta["entries"][number]): string[] {
  return [
    ...new Set(entry.raceScores.map((s) => s.code).filter((c): c is string => !!c)),
  ];
}

export function StartareaStep({ parsedData, onComplete, onBack }: Props) {
  const [inStartAreaMap, setInStartAreaMap] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {};
    parsedData.entries.forEach((entry, i) => {
      map[i] = getSuggestedInStartArea(entry);
    });
    return map;
  });

  function toggle(index: number) {
    setInStartAreaMap((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const inStartCount = Object.values(inStartAreaMap).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Startgebiet-Review</h2>
        <p className="text-sm text-muted-foreground">
          Boote, die ins Startgebiet kamen aber nicht ins Ziel kamen
          (DNS/BFD/OCS/UFD), erhalten R_A&nbsp;=&nbsp;0, zählen aber in s.
          Vorschläge sind auf Basis der Penalty-Codes vorbelegt.
        </p>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-10">Rk.</th>
              <th className="px-3 py-2 text-left">Segelnummer</th>
              <th className="px-3 py-2 text-left">Steuerfrau / -mann</th>
              <th className="px-3 py-2 text-left">Codes</th>
              <th className="px-3 py-2 text-center w-32">Im Startgebiet</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parsedData.entries.map((entry, i) => {
              const codes = getPenaltyCodes(entry);
              const isStartArea = inStartAreaMap[i];
              const suggested = getSuggestedInStartArea(entry);

              return (
                <tr key={i} className={isStartArea ? "bg-amber-50" : ""}>
                  <td className="px-3 py-2 text-muted-foreground">{entry.rank ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.sailNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {entry.helmFirstName} {entry.helmLastName}
                    {entry.crewFirstName && (
                      <span className="text-muted-foreground text-xs ml-1">
                        / {entry.crewFirstName} {entry.crewLastName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {codes.map((code) => (
                        <span
                          key={code}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            IN_START_CODES.has(code)
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {code}
                        </span>
                      ))}
                      {codes.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStartArea}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {isStartArea !== suggested && (
                        <span className="text-xs text-orange-600">(geändert)</span>
                      )}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {inStartCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {inStartCount} Boot{inStartCount !== 1 ? "e" : ""} als &bdquo;im Startgebiet&ldquo; markiert
          → R_A&nbsp;=&nbsp;0, zählen in s.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ← Zurück
        </button>
        <button
          onClick={() => onComplete(inStartAreaMap)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Weiter → (Zuordnung laden)
        </button>
      </div>
    </div>
  );
}
