"use client";

import { useState, useCallback } from "react";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import type { EntryMatchSuggestion, EntryDecision, SailorSummary } from "@/lib/import/types";
import type { MatchResult } from "@/lib/import/matching";

type PersonDecisionUI =
  | { mode: "accepted"; sailorId: string; sailorName: string }
  | { mode: "suggesting"; top: MatchResult; rest: MatchResult[] }
  | { mode: "picking" }
  | { mode: "creating"; firstName: string; lastName: string };

type EntryRowState = {
  helmDecision: PersonDecisionUI;
  crewDecision: PersonDecisionUI | null;
};

function initialPersonDecision(
  matches: MatchResult[],
  fallbackFirstName: string,
  fallbackLastName: string
): PersonDecisionUI {
  if (matches.length === 0) {
    return { mode: "creating", firstName: fallbackFirstName, lastName: fallbackLastName };
  }
  const top = matches[0];
  if (top.confidence === "high") {
    return {
      mode: "accepted",
      sailorId: top.candidate.id,
      sailorName: `${top.candidate.firstName} ${top.candidate.lastName}`,
    };
  }
  return { mode: "suggesting", top, rest: matches.slice(1) };
}

function sailorDisplayName(s: SailorSummary) {
  return `${s.lastName}, ${s.firstName}${s.sailingLicenseId ? ` (${s.sailingLicenseId})` : ""}`;
}

// ── PersonWidget ──────────────────────────────────────────────────────────────

type PersonWidgetProps = {
  decision: PersonDecisionUI;
  allSailors: SailorSummary[];
  onChange: (next: PersonDecisionUI) => void;
};

function PersonWidget({ decision, allSailors, onChange }: PersonWidgetProps) {
  if (decision.mode === "accepted") {
    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          ✓ {decision.sailorName}
        </span>
        <button
          onClick={() => onChange({ mode: "picking" })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Ändern
        </button>
      </div>
    );
  }

  if (decision.mode === "suggesting") {
    const { top } = decision;
    const name = `${top.candidate.firstName} ${top.candidate.lastName}`;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          ⚠ {name} ({Math.round(top.score * 100)}%)
        </span>
        <button
          onClick={() =>
            onChange({ mode: "accepted", sailorId: top.candidate.id, sailorName: name })
          }
          className="text-xs text-blue-600 hover:underline"
        >
          Akzeptieren
        </button>
        <button
          onClick={() => onChange({ mode: "picking" })}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Ändern
        </button>
        <button
          onClick={() =>
            onChange({
              mode: "creating",
              firstName: top.candidate.firstName,
              lastName: top.candidate.lastName,
            })
          }
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Neu anlegen
        </button>
      </div>
    );
  }

  if (decision.mode === "picking") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <select
          className="text-xs border rounded px-2 py-1 max-w-xs"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            const sailor = allSailors.find((s) => s.id === id);
            if (sailor) {
              onChange({
                mode: "accepted",
                sailorId: id,
                sailorName: `${sailor.firstName} ${sailor.lastName}`,
              });
            }
          }}
        >
          <option value="">— Segler wählen —</option>
          {allSailors.map((s) => (
            <option key={s.id} value={s.id}>
              {sailorDisplayName(s)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onChange({ mode: "creating", firstName: "", lastName: "" })}
          className="text-xs text-blue-600 hover:underline"
        >
          Neu anlegen
        </button>
      </div>
    );
  }

  // creating
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-muted-foreground">Neu:</span>
      <input
        type="text"
        placeholder="Vorname"
        value={decision.firstName}
        onChange={(e) =>
          onChange({ mode: "creating", firstName: e.target.value, lastName: decision.lastName })
        }
        className="text-xs border rounded px-2 py-0.5 w-28"
      />
      <input
        type="text"
        placeholder="Nachname"
        value={decision.lastName}
        onChange={(e) =>
          onChange({ mode: "creating", firstName: decision.firstName, lastName: e.target.value })
        }
        className="text-xs border rounded px-2 py-0.5 w-28"
      />
      <button
        onClick={() => onChange({ mode: "picking" })}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Suchen
      </button>
    </div>
  );
}

// ── MatchingStep ──────────────────────────────────────────────────────────────

type Props = {
  parsedData: ParsedRegatta;
  inStartAreaMap: Record<number, boolean>;
  suggestions: EntryMatchSuggestion[];
  allSailors: SailorSummary[];
  onComplete: (decisions: EntryDecision[]) => void;
};

export function MatchingStep({
  parsedData,
  inStartAreaMap,
  suggestions,
  allSailors,
  onComplete,
}: Props) {
  const [rowStates, setRowStates] = useState<EntryRowState[]>(() =>
    suggestions.map((sug, i) => {
      const entry = parsedData.entries[i];
      return {
        helmDecision: initialPersonDecision(
          sug.helm.matches,
          entry.helmFirstName,
          entry.helmLastName
        ),
        crewDecision: sug.crew
          ? initialPersonDecision(
              sug.crew.matches,
              sug.crew.query.firstName,
              sug.crew.query.lastName
            )
          : null,
      };
    })
  );

  const updateHelm = useCallback((index: number, next: PersonDecisionUI) => {
    setRowStates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], helmDecision: next };
      return copy;
    });
  }, []);

  const updateCrew = useCallback((index: number, next: PersonDecisionUI) => {
    setRowStates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], crewDecision: next };
      return copy;
    });
  }, []);

  function acceptAllHigh() {
    setRowStates((prev) =>
      prev.map((row) => {
        const helm = row.helmDecision;
        if (helm.mode === "suggesting" && helm.top.confidence === "high") {
          return {
            ...row,
            helmDecision: {
              mode: "accepted",
              sailorId: helm.top.candidate.id,
              sailorName: `${helm.top.candidate.firstName} ${helm.top.candidate.lastName}`,
            },
          };
        }
        return row;
      })
    );
  }

  function isPending(d: PersonDecisionUI): boolean {
    if (d.mode === "suggesting") return true;
    if (d.mode === "picking") return true;
    if (d.mode === "creating" && (!d.firstName.trim() || !d.lastName.trim())) return true;
    return false;
  }

  const pendingCount = rowStates.filter(
    (r) =>
      isPending(r.helmDecision) ||
      (r.crewDecision !== null && isPending(r.crewDecision))
  ).length;

  const hasSuggesting = rowStates.some(
    (r) =>
      r.helmDecision.mode === "suggesting" ||
      (r.crewDecision !== null && r.crewDecision.mode === "suggesting")
  );

  function buildDecisions(): EntryDecision[] {
    return rowStates.map((row, i) => {
      const entry = parsedData.entries[i];

      function toPersonDecision(
        d: PersonDecisionUI
      ): EntryDecision["helmDecision"] {
        if (d.mode === "accepted") return { type: "accept", sailorId: d.sailorId };
        if (d.mode === "creating") return { type: "create", firstName: d.firstName, lastName: d.lastName };
        // fallback: create from query
        return { type: "create", firstName: "", lastName: "" };
      }

      const helmDecision = toPersonDecision(row.helmDecision);

      let crewDecision: EntryDecision["crewDecision"] = { type: "none" };
      if (row.crewDecision !== null) {
        crewDecision = toPersonDecision(row.crewDecision) as EntryDecision["crewDecision"];
      }

      return {
        entryIndex: i,
        helmDecision,
        crewDecision,
        inStartArea: inStartAreaMap[i] ?? false,
        sailNumber: entry.sailNumber,
        finalRank: entry.rank,
        finalPoints: entry.netPoints,
        racePoints: entry.raceScores,
        club: entry.club,
      };
    });
  }

  const autoCount = rowStates.filter(
    (r) => r.helmDecision.mode === "accepted"
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-1">Segler zuordnen</h2>
        <p className="text-sm text-muted-foreground">
          Ordne jeden Eintrag einem Segler in der Datenbank zu oder lege neue Segler an.
          Grün = hohe Übereinstimmung (automatisch vorbelegt). Gelb = manuelle Bestätigung
          nötig.
        </p>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-muted-foreground">
          {autoCount} automatisch · {pendingCount} ausstehend
        </span>
        {hasSuggesting && (
          <button
            onClick={acceptAllHigh}
            className="px-3 py-1 text-xs border border-green-400 text-green-700 rounded hover:bg-green-50"
          >
            Alle hohen Treffer akzeptieren
          </button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-10">Rk.</th>
              <th className="px-3 py-2 text-left w-24">Segel</th>
              <th className="px-3 py-2 text-left">Geparster Name (Steuermann)</th>
              <th className="px-3 py-2 text-left">Zuordnung Steuermann</th>
              <th className="px-3 py-2 text-left">Geparster Name (Crew)</th>
              <th className="px-3 py-2 text-left">Zuordnung Crew</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parsedData.entries.map((entry, i) => {
              const row = rowStates[i];
              const sug = suggestions[i];
              return (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {entry.rank ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {entry.sailNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {entry.helmFirstName} {entry.helmLastName}
                  </td>
                  <td className="px-3 py-2.5">
                    <PersonWidget
                      decision={row.helmDecision}
                      allSailors={allSailors}
                      onChange={(next) => updateHelm(i, next)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {sug.crew
                      ? `${sug.crew.query.firstName} ${sug.crew.query.lastName}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.crewDecision !== null ? (
                      <PersonWidget
                        decision={row.crewDecision}
                        allSailors={allSailors}
                        onChange={(next) => updateCrew(i, next)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingCount > 0 && (
        <p className="text-xs text-amber-700">
          {pendingCount} Eintr{pendingCount !== 1 ? "äge" : "ag"} noch nicht abgeschlossen.
          Bitte alle Zuordnungen bestätigen.
        </p>
      )}

      <button
        onClick={() => onComplete(buildDecisions())}
        disabled={pendingCount > 0}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Weiter → Vorschau
      </button>
    </div>
  );
}
