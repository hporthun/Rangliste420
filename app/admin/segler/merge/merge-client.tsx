"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import {
  previewMergeSailorsAction,
  mergeSailorsAction,
  type MergePreview,
} from "@/lib/actions/sailors";
import { normalizeName } from "@/lib/import/normalize";

export type SailorCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  gender: string | null;
  club: string | null;
  sailingLicenseId: string | null;
  entryCount: number;
};

type Props = {
  candidates: SailorCandidate[];
  initialPrimaryId?: string;
  initialSecondaryId?: string;
};

export function MergeClient({ candidates, initialPrimaryId, initialSecondaryId }: Props) {
  const router = useRouter();
  const [primaryId, setPrimaryId] = useState<string | null>(initialPrimaryId ?? null);
  const [secondaryId, setSecondaryId] = useState<string | null>(initialSecondaryId ?? null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, startMerge] = useTransition();
  const [mergeResult, setMergeResult] = useState<MergePreview | null>(null);

  const primary = candidates.find((c) => c.id === primaryId) ?? null;
  const secondary = candidates.find((c) => c.id === secondaryId) ?? null;

  // Auto-fetch preview when both selected
  useEffect(() => {
    if (!primaryId || !secondaryId) {
      setPreview(null); // eslint-disable-line react-hooks/set-state-in-effect
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await previewMergeSailorsAction(primaryId, secondaryId);
      if (cancelled) return;
      if (res.ok) {
        setPreview(res.preview);
        setError(null);
      } else {
        setPreview(null);
        setError(res.error);
      }
    })();
    return () => { cancelled = true; };
  }, [primaryId, secondaryId]);

  function handleMerge() {
    if (!primaryId || !secondaryId) return;
    setError(null);
    startMerge(async () => {
      const res = await mergeSailorsAction(primaryId, secondaryId);
      if (res.ok) {
        setMergeResult(res.preview);
        setPrimaryId(null);
        setSecondaryId(null);
        setPreview(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (mergeResult) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 px-5 py-4 space-y-3">
        <p className="flex items-center gap-2 font-medium text-green-900">
          <CheckCircle2 className="h-5 w-5" />
          Segler erfolgreich zusammengeführt.
        </p>
        <div className="text-sm space-y-1 text-green-900">
          <p>
            <strong>{mergeResult.secondary.firstName} {mergeResult.secondary.lastName}</strong>
            {" "}wurde gelöscht und alle Regatta-Einträge auf{" "}
            <strong>{mergeResult.primary.firstName} {mergeResult.primary.lastName}</strong>
            {" "}übertragen.
          </p>
          <ul className="ml-5 list-disc text-xs text-green-800">
            <li>Steuermann-Einträge übertragen: {mergeResult.helmEntriesCount}</li>
            <li>Crew-Einträge übertragen: {mergeResult.crewEntriesCount}</li>
            <li>Alternative Namen ergänzt: {mergeResult.newAlternativeNames.length}</li>
            <li>Stammdaten-Felder übernommen: {mergeResult.fieldsToFill.length}</li>
          </ul>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setMergeResult(null)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
          >
            Weiteren Merge durchführen
          </button>
          <a
            href={`/admin/segler/${mergeResult.primary.id}`}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            Zum primären Segler →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Picker grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <SailorColumn
          title="Primär (bleibt)"
          subtitle="Empfehlung: der Datensatz mit den vollständigeren Stammdaten"
          candidates={candidates}
          selectedId={primaryId}
          excludeId={secondaryId}
          onSelect={setPrimaryId}
        />
        <div className="hidden md:flex items-center justify-center pt-12">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>
        <SailorColumn
          title="Sekundär (wird gelöscht)"
          subtitle="Alle Einträge werden auf den primären übertragen"
          candidates={candidates}
          selectedId={secondaryId}
          excludeId={primaryId}
          onSelect={setSecondaryId}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview */}
      {preview && primary && secondary && (
        <div className="rounded-md border bg-card px-5 py-4 space-y-4">
          <h2 className="font-semibold text-base">Vorschau</h2>

          {preview.conflictingRegattas.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  Konflikt: beide Segler sind in folgenden Regatten als Steuermann eingetragen:
                </p>
                <ul className="ml-4 list-disc text-xs mt-1">
                  {preview.conflictingRegattas.map((r) => (
                    <li key={r.id}>{r.name}</li>
                  ))}
                </ul>
                <p className="text-xs mt-1.5">
                  Bitte einen der beiden Einträge zuerst manuell entfernen oder dem
                  korrekten Segler zuordnen.
                </p>
              </div>
            </div>
          ) : (
            <ul className="text-sm space-y-1.5">
              <li>
                <span className="text-muted-foreground">Steuermann-Einträge übertragen:</span>{" "}
                <span className="font-medium">{preview.helmEntriesCount}</span>
              </li>
              <li>
                <span className="text-muted-foreground">Crew-Einträge übertragen:</span>{" "}
                <span className="font-medium">{preview.crewEntriesCount}</span>
              </li>
              {preview.newAlternativeNames.length > 0 && (
                <li>
                  <span className="text-muted-foreground">Alternative Namen ergänzt:</span>{" "}
                  <span className="font-mono text-xs">
                    {preview.newAlternativeNames.join(", ")}
                  </span>
                </li>
              )}
              {preview.fieldsToFill.length > 0 && (
                <li>
                  <span className="text-muted-foreground">Stammdaten ergänzt:</span>{" "}
                  <span className="text-xs">
                    {preview.fieldsToFill.map((f) => `${f.field}: ${f.value}`).join(", ")}
                  </span>
                </li>
              )}
            </ul>
          )}

          {preview.conflictingRegattas.length === 0 && (
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Jetzt zusammenführen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── SailorColumn ──────────────────────────────────────────────────────────────

type ColumnProps = {
  title: string;
  subtitle: string;
  candidates: SailorCandidate[];
  selectedId: string | null;
  excludeId: string | null;
  onSelect: (id: string | null) => void;
};

function SailorColumn({ title, subtitle, candidates, selectedId, excludeId, onSelect }: ColumnProps) {
  const [query, setQuery] = useState("");
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return [];
    return candidates
      .filter((c) => c.id !== excludeId)
      .filter((c) => {
        const nameAB = normalizeName(`${c.firstName} ${c.lastName}`);
        const nameBA = normalizeName(`${c.lastName} ${c.firstName}`);
        if (nameAB.includes(q) || nameBA.includes(q)) return true;
        if (c.sailingLicenseId && normalizeName(c.sailingLicenseId).includes(q)) return true;
        return false;
      })
      .slice(0, 20);
  }, [query, candidates, excludeId]);

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {selected ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium">
            {selected.firstName} {selected.lastName}
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {selected.club && <li>Verein: {selected.club}</li>}
            <li>Geburtsjahr: {selected.birthYear ?? <em className="opacity-60">fehlt</em>}</li>
            <li>Geschlecht: {selected.gender ?? <em className="opacity-60">fehlt</em>}</li>
            {selected.sailingLicenseId && <li>Segelnummer: {selected.sailingLicenseId}</li>}
            <li>Regatta-Einträge: {selected.entryCount}</li>
          </ul>
          <button
            onClick={() => { onSelect(null); setQuery(""); }}
            className="text-xs text-blue-600 hover:underline pt-1"
          >
            Anderen wählen
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name oder Segelnummer suchen…"
            className="w-full rounded-md border px-2.5 py-1.5 text-sm"
          />
          {query && filtered.length > 0 && (
            <ul className="border rounded-md max-h-56 overflow-y-auto divide-y bg-card">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => { onSelect(c.id); setQuery(""); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted text-sm"
                  >
                    <span className="font-medium">
                      {c.lastName}, {c.firstName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {c.club ?? "—"} · {c.entryCount} Einträge
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Keine Treffer.</p>
          )}
        </div>
      )}
    </div>
  );
}
