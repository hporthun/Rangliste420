"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw, Download, AlertCircle } from "lucide-react";
import { checkM2SRaceCountsAction, type RaceDiff } from "@/lib/actions/regattas";

export type RegattaRow = {
  id: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string;
  numDays: number;
  completedRaces: number;
  ranglistenFaktor: number;
  isRanglistenRegatta: boolean;
  sourceUrl: string | null;
  entryCount: number;
};

type Props = {
  regattas: RegattaRow[];
  year: number | "all";
  q: string;
};

type SyncState = "idle" | "loading" | "done" | "error";

export function RegattaTableWithSync({ regattas, year, q }: Props) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [diffs, setDiffs] = useState<Record<string, RaceDiff>>({});
  const [checkedCount, setCheckedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    if (year === "all") return;
    setSyncError(null);
    setSyncState("loading");
    startTransition(async () => {
      const res = await checkM2SRaceCountsAction(year);
      if (!res.ok) {
        setSyncError(res.error);
        setSyncState("error");
        return;
      }
      setDiffs(res.diffs);
      setCheckedCount(res.checked);
      setSyncState("done");
    });
  }

  const diffCount = Object.keys(diffs).length;

  return (
    <div className="space-y-3">
      {/* Sync controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {year !== "all" && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Wird geprüft…" : "M2S abgleichen"}
            </button>
          )}

          {syncState === "done" && (
            <span className="text-xs text-muted-foreground">
              {checkedCount} Regatten geprüft
              {diffCount > 0 ? (
                <span className="ml-1 font-medium text-amber-700">
                  · {diffCount} Unterschied{diffCount !== 1 ? "e" : ""}
                </span>
              ) : (
                <span className="ml-1 text-green-700">· alles aktuell ✓</span>
              )}
            </span>
          )}

          {syncState === "error" && syncError && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {syncError}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {regattas.length === 0 ? (
        <div className="rounded border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
          {q
            ? `Keine Regatten für „${q}"${year !== "all" ? ` in ${year}` : ""} gefunden.`
            : year === "all"
            ? "Noch keine Regatten angelegt."
            : `Keine Regatten in ${year}.`}
        </div>
      ) : (
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Datum</th>
              <th className="px-3 py-2 text-left font-medium">f</th>
              <th className="px-3 py-2 text-left font-medium">WF</th>
              <th className="px-3 py-2 text-left font-medium">Boote</th>
              <th className="px-3 py-2 text-left font-medium">RL</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {regattas.map((r) => {
              const diff = diffs[r.id];
              const hasDiff = !!diff;
              const importUrl = `/admin/import?regattaId=${r.id}${
                r.sourceUrl ? `&m2sUrl=${encodeURIComponent(r.sourceUrl)}` : ""
              }`;

              return (
                <tr
                  key={r.id}
                  className={hasDiff ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}
                >
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/admin/regatten/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                    {r.location && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({r.location})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(r.startDate).toLocaleDateString("de-DE")}
                    {r.numDays > 1 &&
                      `–${new Date(r.endDate).toLocaleDateString("de-DE")}`}
                  </td>
                  <td className="px-3 py-2">{r.ranglistenFaktor.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {hasDiff ? (
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground line-through">
                          {diff.ourRaces}
                        </span>
                        <span className="font-semibold text-amber-700">
                          → {diff.m2sRaces}
                        </span>
                      </span>
                    ) : (
                      r.completedRaces
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.entryCount}</td>
                  <td className="px-3 py-2">
                    {r.isRanglistenRegatta ? (
                      <span className="font-medium text-green-700">ja</span>
                    ) : (
                      <span className="text-muted-foreground">nein</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {hasDiff ? (
                      <Link
                        href={importUrl}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Ergebnisse importieren
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/regatten/${r.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Bearbeiten
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
