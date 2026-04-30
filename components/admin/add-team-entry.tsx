"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, Loader2, Search } from "lucide-react";
import { addTeamEntryAction } from "@/lib/actions/team-entries";

type Sailor = { id: string; firstName: string; lastName: string };

type RaceScore = {
  race: number;
  points: number;
  code: string | null;
  isDiscard: boolean;
};

type Props = {
  regattaId: string;
  numRaces: number;
  sailors: Sailor[];
};

const SAILING_CODES = ["", "DNC", "DNS", "DNF", "OCS", "BFD", "UFD", "DSQ", "RET", "DNE"];

function SailorPicker({
  label,
  sailors,
  value,
  onChange,
  required,
}: {
  label: string;
  sailors: Sailor[];
  value: Sailor | null;
  onChange: (s: Sailor | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? sailors.filter((s) => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase();
        const rev = `${s.lastName} ${s.firstName}`.toLowerCase();
        const q = query.toLowerCase();
        return full.includes(q) || rev.includes(q);
      })
    : [];

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function select(s: Sailor) {
    onChange(s);
    setQuery(`${s.firstName} ${s.lastName}`);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value) onChange(null);
            }}
            onFocus={() => { if (query) setOpen(true); }}
            placeholder="Name suchen…"
            className="w-full rounded-md border border-input bg-background pl-7 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {value && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg text-sm">
            {filtered.slice(0, 20).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); select(s); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted"
                >
                  {s.lastName}, {s.firstName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value && (
        <p className="text-[11px] text-green-700">
          ✓ {value.firstName} {value.lastName}
        </p>
      )}
    </div>
  );
}

export function AddTeamEntry({ regattaId, numRaces, sailors }: Props) {
  const [open, setOpen] = useState(false);
  const [helm, setHelm] = useState<Sailor | null>(null);
  const [crew, setCrew] = useState<Sailor | null>(null);
  const [sailNumber, setSailNumber] = useState("");
  const [inStartArea, setInStartArea] = useState(false);
  const [scores, setScores] = useState<RaceScore[]>(() =>
    Array.from({ length: numRaces }, (_, i) => ({
      race: i + 1,
      points: 0,
      code: null,
      isDiscard: false,
    }))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function resetForm() {
    setHelm(null);
    setCrew(null);
    setSailNumber("");
    setInStartArea(false);
    setScores(
      Array.from({ length: numRaces }, (_, i) => ({
        race: i + 1,
        points: 0,
        code: null,
        isDiscard: false,
      }))
    );
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function updateScore(race: number, field: keyof RaceScore, value: unknown) {
    setScores((prev) =>
      prev.map((s) => (s.race === race ? { ...s, [field]: value } : s))
    );
  }

  function handleSave() {
    if (!helm) {
      setError("Bitte einen Steuermann auswählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addTeamEntryAction({
        regattaId,
        helmId: helm.id,
        crewId: crew?.id ?? null,
        sailNumber: sailNumber.trim() || null,
        inStartArea,
        raceScores: scores.map((s) => ({
          race: s.race,
          points: s.points,
          code: s.code || null,
          isDiscard: s.isDiscard,
        })),
      });
      if (res.ok) {
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Eintrag hinzufügen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-card border rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h2 className="text-sm font-semibold">Eintrag hinzufügen</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              <SailorPicker
                label="Steuermann"
                sailors={sailors}
                value={helm}
                onChange={setHelm}
                required
              />

              <SailorPicker
                label="Vorschoter (optional)"
                sailors={sailors}
                value={crew}
                onChange={setCrew}
              />

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

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={inStartArea}
                  onChange={(e) => setInStartArea(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Ins Startgebiet gekommen (SG) — R_A = 0, zählt in s</span>
              </label>

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
                    Netto = Summe aller nicht gestrichenen Wertungen.
                    Platzierungen werden automatisch neu vergeben.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

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
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
