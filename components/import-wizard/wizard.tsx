"use client";

import { useState } from "react";
import Link from "next/link";
import { getMatchSuggestionsAction } from "@/lib/actions/import";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import type { EntryMatchSuggestion, EntryDecision, SailorSummary } from "@/lib/import/types";
import { SourceStep } from "./source-step";
import { MetadataStep } from "./metadata-step";
import { StartareaStep } from "./startarea-step";
import { MatchingStep } from "./matching-step";
import { PreviewStep } from "./preview-step";

export type RegattaOption = {
  id: string;
  name: string;
  startDate: string;
  completedRaces: number;
  ranglistenFaktor: number;
};

type WizardState =
  | { step: "source" }
  | { step: "metadata"; parsedData: ParsedRegatta }
  | { step: "startarea"; parsedData: ParsedRegatta; regattaId: string }
  | {
      step: "matching";
      parsedData: ParsedRegatta;
      regattaId: string;
      inStartAreaMap: Record<number, boolean>;
      suggestions: EntryMatchSuggestion[];
      allSailors: SailorSummary[];
    }
  | {
      step: "preview";
      parsedData: ParsedRegatta;
      regattaId: string;
      entryDecisions: EntryDecision[];
    }
  | { step: "done" };

const STEPS = ["Quelle", "Regatta", "Startgebiet", "Zuordnung", "Vorschau"] as const;
const STEP_KEYS: WizardState["step"][] = [
  "source",
  "metadata",
  "startarea",
  "matching",
  "preview",
];

export function ImportWizard({
  regattas,
  initialRegattaId,
  initialM2sUrl,
}: {
  regattas: RegattaOption[];
  initialRegattaId?: string;
  initialM2sUrl?: string;
}) {
  const [state, setState] = useState<WizardState>({ step: "source" });
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEP_KEYS.indexOf(state.step as (typeof STEP_KEYS)[number]);

  function handleSourceComplete(parsedData: ParsedRegatta) {
    setState({ step: "metadata", parsedData });
    setError(null);
  }

  function handleMetadataComplete(regattaId: string) {
    if (state.step !== "metadata") return;
    setState({ step: "startarea", parsedData: state.parsedData, regattaId });
    setError(null);
  }

  async function handleStartareaComplete(inStartAreaMap: Record<number, boolean>) {
    if (state.step !== "startarea") return;
    setTransitioning(true);
    setError(null);
    const result = await getMatchSuggestionsAction(
      state.parsedData.entries.map((e) => ({
        helmFirstName: e.helmFirstName,
        helmLastName: e.helmLastName,
        crewFirstName: e.crewFirstName,
        crewLastName: e.crewLastName,
        sailNumber: e.sailNumber,
      }))
    );
    setTransitioning(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState({
      step: "matching",
      parsedData: state.parsedData,
      regattaId: state.regattaId,
      inStartAreaMap,
      suggestions: result.data.suggestions,
      allSailors: result.data.allSailors,
    });
  }

  function handleMatchingComplete(entryDecisions: EntryDecision[]) {
    if (state.step !== "matching") return;
    setState({
      step: "preview",
      parsedData: state.parsedData,
      regattaId: state.regattaId,
      entryDecisions,
    });
    setError(null);
  }

  function handleDone() {
    setState({ step: "done" });
  }

  function handleReset() {
    setState({ step: "source" });
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium shrink-0 ${
                stepIndex > i
                  ? "bg-green-600 text-white"
                  : stepIndex === i
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {stepIndex > i ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm hidden sm:block ${
                stepIndex === i ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {transitioning && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Lade Zuordnungsvorschläge…
        </div>
      )}

      {state.step === "source" && !transitioning && (
        <SourceStep
          onComplete={handleSourceComplete}
          initialM2sUrl={initialM2sUrl}
        />
      )}

      {state.step === "metadata" && !transitioning && (
        <MetadataStep
          regattas={regattas}
          parsedData={state.parsedData}
          initialRegattaId={initialRegattaId}
          onComplete={handleMetadataComplete}
          onBack={() => setState({ step: "source" })}
        />
      )}

      {state.step === "startarea" && !transitioning && (
        <StartareaStep
          parsedData={state.parsedData}
          onComplete={handleStartareaComplete}
          onBack={() =>
            setState({
              step: "metadata",
              parsedData: state.parsedData,
            })
          }
        />
      )}

      {state.step === "matching" && !transitioning && (
        <MatchingStep
          parsedData={state.parsedData}
          inStartAreaMap={state.inStartAreaMap}
          suggestions={state.suggestions}
          allSailors={state.allSailors}
          onComplete={handleMatchingComplete}
        />
      )}

      {state.step === "preview" && !transitioning && (
        <PreviewStep
          parsedData={state.parsedData}
          regattaId={state.regattaId}
          regattas={regattas}
          entryDecisions={state.entryDecisions}
          onDone={handleDone}
          onReset={handleReset}
        />
      )}

      {state.step === "done" && (
        <div className="rounded-md bg-green-50 border border-green-200 px-6 py-8 text-center space-y-3">
          <p className="text-green-700 font-semibold">Import erfolgreich!</p>
          <p className="text-sm text-muted-foreground">
            Alle Ergebnisse wurden gespeichert.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/admin/regatten" className="text-sm text-blue-600 hover:underline">
              Zur Regattenliste →
            </Link>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:underline"
            >
              Weiteren Import starten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
