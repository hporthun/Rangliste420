"use client";

import { useState, useTransition, useRef } from "react";
import {
  previewStammdatenCsvAction,
  applyStammdatenCsvAction,
  type StammdatenCsvPreviewRow,
} from "@/lib/actions/sailors";

type Decision =
  | { kind: "update"; sailorId: string; birthYear: number }
  | { kind: "create"; firstName: string; lastName: string; birthYear: number | null }
  | { kind: "skip" };

export function StammdatenCsvImport() {
  const [preview, setPreview] = useState<StammdatenCsvPreviewRow[] | null>(null);
  const [decisions, setDecisions] = useState<Map<number, Decision>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      runPreview(text);
    };
    reader.readAsText(file, "utf-8");
  }

  function runPreview(text: string) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await previewStammdatenCsvAction(text);
      if (!res.ok) { setError(res.error); return; }

      setPreview(res.rows);
      // Default decisions
      const map = new Map<number, Decision>();
      for (const row of res.rows) {
        if (row.matchType !== "none") {
          // Update: pre-check if CSV has a year AND DB year is null or different
          const shouldUpdate =
            row.birthYear !== null &&
            (row.matchedBirthYear === null || row.matchedBirthYear !== row.birthYear);
          if (shouldUpdate) {
            map.set(row.idx, { kind: "update", sailorId: row.matchedSailorId!, birthYear: row.birthYear! });
          } else {
            map.set(row.idx, { kind: "skip" });
          }
        } else {
          // New sailor: pre-check create
          map.set(row.idx, { kind: "create", firstName: row.firstName, lastName: row.lastName, birthYear: row.birthYear });
        }
      }
      setDecisions(map);
    });
  }

  function setDecision(idx: number, d: Decision) {
    setDecisions((prev) => new Map(prev).set(idx, d));
  }

  function apply() {
    setError(null);
    const updates: Array<{ sailorId: string; birthYear: number }> = [];
    const newSailors: Array<{ firstName: string; lastName: string; birthYear: number | null }> = [];

    for (const [, d] of decisions) {
      if (d.kind === "update") updates.push({ sailorId: d.sailorId, birthYear: d.birthYear });
      if (d.kind === "create") newSailors.push({ firstName: d.firstName, lastName: d.lastName, birthYear: d.birthYear });
    }

    startTransition(async () => {
      const res = await applyStammdatenCsvAction({ updates, newSailors });
      if (!res.ok) { setError(res.error); return; }
      const parts: string[] = [];
      if (res.updated > 0) parts.push(`${res.updated} Segler aktualisiert`);
      if (res.created > 0) parts.push(`${res.created} Segler neu angelegt`);
      setResult(parts.join(", ") + ".");
      setPreview(null);
      setDecisions(new Map());
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  // Counts for the apply button
  const updateCount = [...decisions.values()].filter((d) => d.kind === "update").length;
  const createCount = [...decisions.values()].filter((d) => d.kind === "create").length;
  const totalActions = updateCount + createCount;

  const matchedCount = preview?.filter((r) => r.matchType !== "none").length ?? 0;
  const newCount = preview?.filter((r) => r.matchType === "none").length ?? 0;

  return (
    <div className="space-y-4">
      {!preview && (
        <>
          <p className="text-xs text-muted-foreground">
            CSV-Datei mit Spalten{" "}
            <code className="font-mono bg-muted px-1 rounded">Name · Vorname · Geburtsjahr</code>
            {" "}(kommagetrennt, mit Headerzeile). Geburtsjahr ist optional.
            Segler werden per Fuzzy-Matching zugeordnet. Neu erkannte Segler
            können direkt angelegt werden.
          </p>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={loadFile}
                disabled={isPending}
              />
              CSV-Datei auswählen
            </label>
            {isPending && <span className="text-sm text-muted-foreground">Lade Vorschau…</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Erwartetes Format: <code className="font-mono bg-muted px-1 rounded">Mustermann,Max,2009</code>
          </p>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
      )}

      {result && (
        <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2">{result}</p>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {preview.length} Zeilen · {matchedCount} zugeordnet · {newCount} neu
            </span>
            <button
              onClick={() => { setPreview(null); setDecisions(new Map()); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Neue Datei
            </button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">CSV-Zeile</th>
                  <th className="px-3 py-2 text-left">Treffer in DB</th>
                  <th className="px-3 py-2 text-center w-14">Conf.</th>
                  <th className="px-3 py-2 text-center w-20">CSV Jg.</th>
                  <th className="px-3 py-2 text-center w-20">DB Jg.</th>
                  <th className="px-3 py-2 text-center w-36">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((row) => {
                  const dec = decisions.get(row.idx) ?? { kind: "skip" };
                  const birthYearSame =
                    row.matchedBirthYear !== null && row.matchedBirthYear === row.birthYear;
                  const birthYearConflict =
                    row.matchedBirthYear !== null &&
                    row.birthYear !== null &&
                    row.matchedBirthYear !== row.birthYear;

                  return (
                    <tr
                      key={row.idx}
                      className={
                        row.matchType === "none"
                          ? "bg-blue-50/40"
                          : row.matchType === "fuzzy"
                          ? "bg-amber-50/40"
                          : ""
                      }
                    >
                      {/* CSV row */}
                      <td className="px-3 py-2">
                        <span>
                          {row.lastName}, {row.firstName}
                        </span>
                        {row.duplicateName && (
                          <span
                            title="Dieser Name erscheint mehrfach in der CSV mit unterschiedlichem Geburtsjahr"
                            className="ml-1.5 text-amber-600 text-[10px] font-medium border border-amber-300 rounded px-1"
                          >
                            doppelt
                          </span>
                        )}
                      </td>

                      {/* DB match */}
                      <td className="px-3 py-2 font-medium">
                        {row.matchType === "none" ? (
                          <span className="text-blue-700 italic text-xs">nicht in DB</span>
                        ) : (
                          <>
                            {row.matchedName}
                            {row.matchType === "fuzzy" && (
                              <span className="ml-1 text-amber-600 font-normal">
                                ({Math.round(row.matchScore * 100)}%)
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="px-3 py-2 text-center">
                        {row.matchType === "exact" && <span className="text-green-700">✓</span>}
                        {row.matchType === "fuzzy" && <span className="text-amber-600">~</span>}
                        {row.matchType === "none" && <span className="text-blue-500">+</span>}
                      </td>

                      {/* CSV birth year */}
                      <td className="px-3 py-2 text-center font-mono">
                        {row.birthYear ?? <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* DB birth year */}
                      <td className="px-3 py-2 text-center font-mono">
                        {row.matchType === "none" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : row.matchedBirthYear !== null ? (
                          <span className={birthYearConflict ? "text-amber-700 font-semibold" : "text-muted-foreground"}>
                            {row.matchedBirthYear}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Action selector */}
                      <td className="px-3 py-2 text-center">
                        {row.matchType === "none" ? (
                          // New sailor: toggle create/skip
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={dec.kind === "create"}
                              onChange={(e) =>
                                setDecision(
                                  row.idx,
                                  e.target.checked
                                    ? { kind: "create", firstName: row.firstName, lastName: row.lastName, birthYear: row.birthYear }
                                    : { kind: "skip" }
                                )
                              }
                            />
                            Neu anlegen
                          </label>
                        ) : birthYearSame ? (
                          <span className="text-xs text-muted-foreground">bereits gesetzt</span>
                        ) : row.birthYear === null ? (
                          <span className="text-xs text-muted-foreground">kein Jg. in CSV</span>
                        ) : (
                          // Update: toggle update/skip
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={dec.kind === "update"}
                              onChange={(e) =>
                                setDecision(
                                  row.idx,
                                  e.target.checked
                                    ? { kind: "update", sailorId: row.matchedSailorId!, birthYear: row.birthYear! }
                                    : { kind: "skip" }
                                )
                              }
                            />
                            {birthYearConflict ? (
                              <span className="text-amber-700">
                                {row.matchedBirthYear} → {row.birthYear} überschreiben
                              </span>
                            ) : (
                              `Jg. ${row.birthYear} setzen`
                            )}
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={apply}
              disabled={isPending || totalActions === 0}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50"
            >
              {isPending
                ? "Schreibe…"
                : totalActions === 0
                ? "Keine Änderungen ausgewählt"
                : [
                    updateCount > 0 && `${updateCount} aktualisieren`,
                    createCount > 0 && `${createCount} neu anlegen`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
            </button>
            {totalActions > 0 && (
              <span className="text-xs text-muted-foreground">
                {updateCount > 0 && `${updateCount} Geburtsjahr-Update${updateCount > 1 ? "s" : ""}`}
                {updateCount > 0 && createCount > 0 && " · "}
                {createCount > 0 && `${createCount} neue Segler`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
