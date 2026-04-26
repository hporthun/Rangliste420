"use client";

import { useState, useTransition } from "react";
import {
  previewStammdatenAction,
  applyStammdatenAction,
  type StammdatenPreviewRow,
} from "@/lib/actions/sailors";

type RowDecision = {
  row: StammdatenPreviewRow;
  sailorId: string;
  applyBirthYear: boolean;
  applyGender: boolean;
};

export function StammdatenImport() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<StammdatenPreviewRow[] | null>(null);
  const [decisions, setDecisions] = useState<RowDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadPreview() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await previewStammdatenAction(text);
      if (!res.ok) { setError(res.error); return; }
      setPreview(res.rows);
      setDecisions(
        res.rows
          .filter((r) => r.matchType !== "none")
          .map((row) => ({
            row,
            sailorId: row.matchedSailorId!,
            applyBirthYear: !row.alreadySet.birthYear && row.birthYear !== null,
            applyGender: !row.alreadySet.gender && row.gender !== null,
          }))
      );
    });
  }

  function toggleBirthYear(sailorId: string) {
    setDecisions((prev) =>
      prev.map((d) => d.sailorId === sailorId ? { ...d, applyBirthYear: !d.applyBirthYear } : d)
    );
  }

  function toggleGender(sailorId: string) {
    setDecisions((prev) =>
      prev.map((d) => d.sailorId === sailorId ? { ...d, applyGender: !d.applyGender } : d)
    );
  }

  function apply() {
    setError(null);
    const updates = decisions
      .filter((d) => d.applyBirthYear || d.applyGender)
      .map((d) => ({
        sailorId: d.sailorId,
        birthYear: d.applyBirthYear ? d.row.birthYear : null,
        gender: d.applyGender ? d.row.gender : null,
      }));

    startTransition(async () => {
      const res = await applyStammdatenAction(updates);
      if (!res.ok) { setError(res.error); return; }
      setResult(`${res.count} Segler aktualisiert.`);
      setPreview(null);
    });
  }

  const matchedCount = preview?.filter((r) => r.matchType !== "none").length ?? 0;
  const noneCount = preview?.filter((r) => r.matchType === "none").length ?? 0;
  const pendingUpdates = decisions.filter((d) => d.applyBirthYear || d.applyGender).length;

  return (
    <div className="space-y-4">
      {!preview && (
        <>
          <textarea
            className="w-full h-64 font-mono text-xs border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={"499\tReuter\tVincenzo\t2005\tmale\t...\n500\tAlbani\tChiara\t2007\tfemale\t..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={loadPreview}
            disabled={isPending || !text.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Lade…" : "Vorschau laden"}
          </button>
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
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {matchedCount} zugeordnet · {noneCount} nicht gefunden
            </span>
            <button
              onClick={() => { setPreview(null); setDecisions([]); }}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Neu einfügen
            </button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Importzeile</th>
                  <th className="px-3 py-2 text-left">Treffer in DB</th>
                  <th className="px-3 py-2 text-center">Conf.</th>
                  <th className="px-3 py-2 text-center">Jg.</th>
                  <th className="px-3 py-2 text-center">✓ Jg.</th>
                  <th className="px-3 py-2 text-center">Geschl.</th>
                  <th className="px-3 py-2 text-center">✓ Geschl.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((row) => {
                  const dec = decisions.find((d) => d.sailorId === row.matchedSailorId);
                  return (
                    <tr
                      key={row.externalId}
                      className={row.matchType === "none" ? "bg-red-50/50" : row.matchType === "fuzzy" ? "bg-amber-50/50" : ""}
                    >
                      <td className="px-3 py-2">
                        {row.lastName}, {row.firstName}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {row.matchType === "none"
                          ? <span className="text-red-600">nicht gefunden</span>
                          : row.matchedName}
                        {row.matchType === "fuzzy" && (
                          <span className="ml-1 text-amber-600">({Math.round(row.matchScore * 100)}%)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.matchType === "exact" && <span className="text-green-700">✓</span>}
                        {row.matchType === "fuzzy" && <span className="text-amber-600">~</span>}
                        {row.matchType === "none" && <span className="text-red-500">✗</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.birthYear ?? <span className="text-muted-foreground">—</span>}
                        {row.alreadySet.birthYear && <span className="ml-1 text-xs text-muted-foreground">(bereits)</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {dec && row.birthYear !== null ? (
                          <input
                            type="checkbox"
                            checked={dec.applyBirthYear}
                            onChange={() => toggleBirthYear(dec.sailorId)}
                            className="rounded"
                          />
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.gender ?? <span className="text-muted-foreground">—</span>}
                        {row.alreadySet.gender && <span className="ml-1 text-xs text-muted-foreground">(bereits)</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {dec && row.gender !== null ? (
                          <input
                            type="checkbox"
                            checked={dec.applyGender}
                            onChange={() => toggleGender(dec.sailorId)}
                            className="rounded"
                          />
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={apply}
            disabled={isPending || pendingUpdates === 0}
            className="px-4 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50"
          >
            {isPending ? "Schreibe…" : `${pendingUpdates} Segler aktualisieren`}
          </button>
        </div>
      )}
    </div>
  );
}
