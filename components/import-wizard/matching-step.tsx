"use client";

import { useState, useCallback, useMemo } from "react";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import type { EntryMatchSuggestion, EntryDecision, SailorSummary } from "@/lib/import/types";
import type { MatchResult } from "@/lib/import/matching";
import { normalizeName } from "@/lib/import/normalize";

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

// ── SailorPicker ──────────────────────────────────────────────────────────────
// Searchable typeahead replacement for the previous plain <select>. Filters
// the (502+) sailor list by normalised name in either order, plus sail number.
// Issue #5: with so many entries a flat <select> made it impractical to find
// the correct sailor when the suggested partial match was wrong.

type SailorPickerProps = {
  allSailors: SailorSummary[];
  onPick: (sailor: SailorSummary) => void;
  onCreate: () => void;
};

function SailorPicker({ allSailors, onPick, onCreate }: SailorPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return allSailors.slice(0, 40);
    return allSailors
      .filter((s) => {
        const ab = normalizeName(`${s.firstName} ${s.lastName}`);
        const ba = normalizeName(`${s.lastName} ${s.firstName}`);
        if (ab.includes(q) || ba.includes(q)) return true;
        if (s.sailingLicenseId && normalizeName(s.sailingLicenseId).includes(q)) return true;
        return false;
      })
      .slice(0, 40);
  }, [query, allSailors]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Name oder Segelnummer …"
          className="text-xs border rounded px-2 py-1 w-56"
          autoFocus
        />
        <button
          type="button"
          onClick={onCreate}
          className="text-xs text-blue-600 hover:underline"
        >
          Neu anlegen
        </button>
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full mt-1 z-20 max-h-64 overflow-y-auto w-72 rounded-md border bg-card shadow-md text-xs">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-muted transition-colors"
              >
                {sailorDisplayName(s)}
              </button>
            </li>
          ))}
          {filtered.length === 40 && (
            <li className="px-2.5 py-1 text-[10px] text-muted-foreground italic">
              … (weitere Treffer durch genaueren Suchbegriff einschränken)
            </li>
          )}
        </ul>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-md border bg-card shadow-md text-xs px-2.5 py-2 text-muted-foreground">
          Keine Treffer.
        </div>
      )}
    </div>
  );
}

// ── PersonWidget ──────────────────────────────────────────────────────────────

type PersonWidgetProps = {
  decision: PersonDecisionUI;
  allSailors: SailorSummary[];
  /** Parsed name from the import — used as default for "Neu anlegen". Issue #12 */
  parsedFirstName: string;
  parsedLastName: string;
  onChange: (next: PersonDecisionUI) => void;
};

function PersonWidget({
  decision,
  allSailors,
  parsedFirstName,
  parsedLastName,
  onChange,
}: PersonWidgetProps) {
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
    const { top, rest } = decision;
    const topName = `${top.candidate.firstName} ${top.candidate.lastName}`;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            ⚠ {topName} ({Math.round(top.score * 100)}%)
          </span>
          <button
            onClick={() =>
              onChange({ mode: "accepted", sailorId: top.candidate.id, sailorName: topName })
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
                firstName: parsedFirstName,
                lastName: parsedLastName,
              })
            }
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Neu anlegen
          </button>
        </div>
        {/* Show alternative medium matches — Issue #5 fix */}
        {rest.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pl-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              auch ähnlich:
            </span>
            {rest.map((alt) => {
              const altName = `${alt.candidate.firstName} ${alt.candidate.lastName}`;
              return (
                <button
                  key={alt.candidate.id}
                  onClick={() =>
                    onChange({
                      mode: "accepted",
                      sailorId: alt.candidate.id,
                      sailorName: altName,
                    })
                  }
                  className="px-1.5 py-0.5 rounded text-[11px] border border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 transition-colors"
                  title={`Akzeptieren: ${altName}`}
                >
                  {altName} ({Math.round(alt.score * 100)}%)
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (decision.mode === "picking") {
    return (
      <SailorPicker
        allSailors={allSailors}
        onPick={(sailor) =>
          onChange({
            mode: "accepted",
            sailorId: sailor.id,
            sailorName: `${sailor.firstName} ${sailor.lastName}`,
          })
        }
        onCreate={() =>
          onChange({
            mode: "creating",
            firstName: parsedFirstName,
            lastName: parsedLastName,
          })
        }
      />
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
                      parsedFirstName={entry.helmFirstName}
                      parsedLastName={entry.helmLastName}
                      onChange={(next) => updateHelm(i, next)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {sug.crew
                      ? `${sug.crew.query.firstName} ${sug.crew.query.lastName}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.crewDecision !== null && sug.crew ? (
                      <PersonWidget
                        decision={row.crewDecision}
                        allSailors={allSailors}
                        parsedFirstName={sug.crew.query.firstName}
                        parsedLastName={sug.crew.query.lastName}
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
