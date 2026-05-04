"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { updateTeamEntryAction } from "@/lib/actions/team-entries";

type RaceScore = {
  race: number;
  points: number;
  code?: string | null;
  isDiscard: boolean;
};

type Props = {
  teamEntryId: string;
  helmName: string;
  initialSailNumber: string | null;
  initialInStartArea: boolean;
  initialFinalRank: number | null;
  /**
   * true = der Eintrag hat einen manuell vergebenen Rang (Result.isRankManual).
   * Steuert die Vorbelegung des Rang-Inputs: bei false bleibt das Feld leer
   * (Auto-Modus), damit ein Speichern ohne Aenderung den Rang nicht versehentlich
   * auf "manuell" flippt.
   */
  initialIsRankManual?: boolean;
  numRaces: number;
  initialRaceScores: RaceScore[];
};

const SAILING_CODES = ["", "DNC", "DNS", "DNF", "OCS", "BFD", "UFD", "DSQ", "RET", "DNE"];

export function EditTeamEntry({
  teamEntryId,
  helmName,
  initialSailNumber,
  initialInStartArea,
  initialFinalRank,
  initialIsRankManual = false,
  numRaces,
  initialRaceScores,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sailNumber, setSailNumber] = useState(initialSailNumber ?? "");
  const [inStartArea, setInStartArea] = useState(initialInStartArea);
  // Rank-Input nur vorbelegen, wenn der gespeicherte Rang explizit manuell war.
  // Sonst leer lassen — die Spalte zeigt den auto-berechneten Rang ohnehin an.
  // So bleibt das Auto-Reranking aktiv, wenn der Admin den Eintrag oeffnet,
  // andere Felder editiert und ohne Aenderung am Rang speichert.
  const [rankInput, setRankInput] = useState(
    initialIsRankManual && initialFinalRank != null
      ? String(initialFinalRank)
      : "",
  );
  const [scores, setScores] = useState<RaceScore[]>(() => {
    // Ensure we have an entry for every race 1..numRaces
    return Array.from({ length: numRaces }, (_, i) => {
      const existing = initialRaceScores.find((s) => s.race === i + 1);
      return existing ?? { race: i + 1, points: 0, code: null, isDiscard: false };
    });
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function updateScore(race: number, field: keyof RaceScore, value: unknown) {
    setScores((prev) =>
      prev.map((s) => (s.race === race ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    setError(null);
    const rankVal = rankInput.trim() ? parseInt(rankInput.trim(), 10) : null;
    if (rankInput.trim() && (isNaN(rankVal!) || rankVal! < 1)) {
      setError("Platzierung muss eine positive ganze Zahl sein.");
      return;
    }
    startTransition(async () => {
      const res = await updateTeamEntryAction({
        teamEntryId,
        sailNumber: sailNumber.trim() || null,
        inStartArea,
        raceScores: scores.map((s) => ({
          race: s.race,
          points: s.points,
          code: s.code || null,
          isDiscard: s.isDiscard,
        })),
        manualRank: rankVal,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setSailNumber(initialSailNumber ?? "");
    setInStartArea(initialInStartArea);
    setRankInput(
      initialIsRankManual && initialFinalRank != null
        ? String(initialFinalRank)
        : "",
    );
    setScores(
      Array.from({ length: numRaces }, (_, i) => {
        const existing = initialRaceScores.find((s) => s.race === i + 1);
        return existing ?? { race: i + 1, points: 0, code: null, isDiscard: false };
      })
    );
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Eintrag bearbeiten"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-card border rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h2 className="text-sm font-semibold">
                Eintrag bearbeiten — {helmName}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {/* Sail number */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Segelnummer
                </label>
                <input
                  type="text"
                  value={sailNumber}
                  onChange={(e) => setSailNumber(e.target.value)}
                  maxLength={30}
                  placeholder="z.B. GER 1234"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Rank */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Platzierung
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={rankInput}
                    onChange={(e) => setRankInput(e.target.value)}
                    min={1}
                    step={1}
                    placeholder="leer = automatisch"
                    className="w-40 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {rankInput.trim() && (
                    <button
                      type="button"
                      onClick={() => setRankInput("")}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      zurücksetzen
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Leer lassen = Rang wird aus Nettopunkten berechnet.
                  Wert eingeben = Rang wird manuell gesetzt und nicht überschrieben.
                </p>
              </div>

              {/* inStartArea */}
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={inStartArea}
                  onChange={(e) => setInStartArea(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Ins Startgebiet gekommen (SG) — R_A = 0, zählt in s</span>
              </label>

              {/* Race scores */}
              {numRaces > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground pb-1">
                    Wettfahrten
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 text-center w-10">WF</th>
                          <th className="px-2 py-1.5 text-right">Punkte</th>
                          <th className="px-2 py-1.5 text-left">Code</th>
                          <th className="px-2 py-1.5 text-center">Streichung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {scores.map((s) => (
                          <tr key={s.race} className="align-middle">
                            <td className="px-2 py-1 text-center font-medium text-muted-foreground">
                              {s.race}
                            </td>
                            <td className="px-2 py-1 text-right">
                              <input
                                type="number"
                                value={s.points}
                                onChange={(e) =>
                                  updateScore(s.race, "points", parseFloat(e.target.value) || 0)
                                }
                                min={0}
                                step={0.1}
                                className="w-16 text-right rounded border border-input bg-background px-1.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={s.code ?? ""}
                                onChange={(e) =>
                                  updateScore(s.race, "code", e.target.value || null)
                                }
                                className="rounded border border-input bg-background px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {SAILING_CODES.map((c) => (
                                  <option key={c} value={c}>
                                    {c || "—"}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={s.isDiscard}
                                onChange={(e) =>
                                  updateScore(s.race, "isDiscard", e.target.checked)
                                }
                                className="h-3.5 w-3.5 rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Netto = Summe aller nicht gestrichenen Wertungen (wird neu berechnet).
                    Platzierungen der Regatta werden automatisch neu vergeben.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
