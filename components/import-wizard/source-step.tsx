"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseTextAction,
  parsePdfAction,
  fetchM2SResultsAction,
  fetchM2SClassesAction,
} from "@/lib/actions/import";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";

type Props = {
  onComplete: (data: ParsedRegatta) => void;
  /** Wenn gesetzt: API-Tab vorselektieren und URL vorausfüllen */
  initialM2sUrl?: string;
};

type Tab = "paste" | "pdf" | "api";

// Inline URL parser — keeps the component free of server-only imports
// Accepts both UUID and alias (e.g. "LJMMV2025") as event ID
function parseM2SUrlClient(url: string): { eventId: string; classId?: string } | null {
  const em = url.match(/\/event\/([0-9a-zA-Z_-]+)/i);
  if (!em) return null;
  const cm = url.match(/[?&]classId=([0-9a-f-]{36})/i);
  return { eventId: em[1], classId: cm?.[1].toLowerCase() };
}

export function SourceStep({ onComplete, initialM2sUrl }: Props) {
  const [tab, setTab] = useState<Tab>(initialM2sUrl ? "api" : "paste");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // paste state
  const [pasteText, setPasteText] = useState("");

  // pdf state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // api state — vorausfüllen wenn initialM2sUrl übergeben
  const [apiUrl, setApiUrl] = useState(initialM2sUrl ?? "");
  const [parsedIds, setParsedIds] = useState<{ eventId: string; classId?: string } | null>(
    initialM2sUrl ? parseM2SUrlClient(initialM2sUrl) : null
  );
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  // resolvedEventId: the real UUID (may differ from parsedIds.eventId when alias is used)
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);

  // Wenn initialM2sUrl und classId bekannt: direkt auto-fetch beim Mount
  useEffect(() => {
    if (!initialM2sUrl) return;
    const ids = parseM2SUrlClient(initialM2sUrl);
    if (ids?.classId) {
      // Kurz warten damit die Komponente vollständig gerendert ist
      const t = setTimeout(() => handleApiFetch(), 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── reset ────────────────────────────────────────────────────────────────────

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setDetectedFormat(null);
    setAvailableClasses(null);
    setSelectedClassId("");
    setResolvedEventId(null);
  }

  // ── paste ────────────────────────────────────────────────────────────────────

  async function handlePasteSubmit() {
    setError(null);
    if (!pasteText.trim()) { setError("Bitte füge den kopierten Text ein."); return; }
    setLoading(true);
    const res = await parseTextAction(pasteText);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    onComplete(res.data);
  }

  // ── pdf ──────────────────────────────────────────────────────────────────────

  async function handlePdfSubmit() {
    setError(null);
    setDetectedFormat(null);
    if (!pdfFile) { setError("Bitte wähle eine PDF-Datei aus."); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append("file", pdfFile);
    const res = await parsePdfAction(fd);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDetectedFormat(res.format);
    onComplete(res.data);
  }

  // ── api ──────────────────────────────────────────────────────────────────────

  function handleApiUrlChange(url: string) {
    setApiUrl(url);
    setError(null);
    setAvailableClasses(null);
    setSelectedClassId("");
    setResolvedEventId(null);
    const ids = parseM2SUrlClient(url.trim());
    setParsedIds(ids);
  }

  async function handleApiFetch() {
    setError(null);
    const effectiveClassId = selectedClassId || parsedIds?.classId;
    // Use the already-resolved UUID if available (from a previous class-load)
    const effectiveEventId = resolvedEventId ?? parsedIds?.eventId;

    if (!effectiveEventId) {
      setError("Keine gültige Manage2Sail-URL erkannt.");
      return;
    }

    // If we know both IDs (either from URL or dropdown selection), fetch results
    if (effectiveClassId) {
      // Build a canonical URL with the resolved eventId + classId
      const fetchUrl = `https://www.manage2sail.com/de-DE/event/${effectiveEventId}#!/results?classId=${effectiveClassId}`;
      setLoading(true);
      const res = await fetchM2SResultsAction(fetchUrl);
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      onComplete(res.data);
      return;
    }

    // No classId known: fetch class list (also resolves alias → real UUID)
    setLoading(true);
    const classRes = await fetchM2SClassesAction(effectiveEventId);
    setLoading(false);
    if (!classRes.ok) { setError(classRes.error); return; }
    setResolvedEventId(classRes.resolvedEventId);
    setAvailableClasses(classRes.classes);

    // Auto-select strategy:
    //   1) Single class total → take it.
    //   2) Exactly one class whose name contains "420" (case-insensitive,
    //      with optional whitespace/separators) → take it AND immediately
    //      fetch results.  Issue #24: events frequently mix multiple classes,
    //      but the 420er class is always uniquely identifiable by name.
    let autoClassId: string | null = null;
    if (classRes.classes.length === 1) {
      autoClassId = classRes.classes[0].id;
      setSelectedClassId(autoClassId);
    } else {
      const fourTwenty = classRes.classes.filter((c) => /420/.test(c.name));
      if (fourTwenty.length === 1) {
        autoClassId = fourTwenty[0].id;
        setSelectedClassId(autoClassId);
      }
    }

    // If auto-selection landed on a single 420 class (not a single-class
    // event), continue straight to results so the user doesn't have to
    // click again.
    if (autoClassId && classRes.classes.length > 1) {
      const fetchUrl = `https://www.manage2sail.com/de-DE/event/${classRes.resolvedEventId}#!/results?classId=${autoClassId}`;
      setLoading(true);
      const res = await fetchM2SResultsAction(fetchUrl);
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      onComplete(res.data);
    }
  }

  // ── format labels ────────────────────────────────────────────────────────────

  const formatLabel: Record<string, string> = {
    sailwave: "Sailwave",
    sailresults: "SailResults",
    velaware: "Velaware",
    manage2sail: "Manage2Sail",
    unknown: "Unbekannt",
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 text-base font-semibold">Ergebnisse importieren</h2>
        <p className="text-sm text-muted-foreground">
          Wähle eine Importmethode: Manage2Sail API (empfohlen), Web-Copy-Paste oder PDF-Upload.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex w-fit gap-1 rounded-md bg-muted p-1">
        {(["api", "paste", "pdf"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            api: "Manage2Sail API",
            paste: "Web-Copy-Paste",
            pdf: "PDF-Upload",
          };
          return (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-background font-medium text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── API tab ─────────────────────────────────────────────────────────── */}
      {tab === "api" && (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">Manage2Sail Ergebnis-URL</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Auf manage2sail.com zur Klasse → Ergebnisse navigieren, dann die Browser-URL
              kopieren. Sie sollte{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">classId=</code> enthalten.
            </p>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => handleApiUrlChange(e.target.value)}
              placeholder="https://www.manage2sail.com/de-DE/event/…#!/results?classId=…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Parsed ID preview */}
          {parsedIds && (
            <div className="rounded border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground space-y-0.5">
              <div>Event-ID:&nbsp;&nbsp;{parsedIds.eventId}</div>
              {parsedIds.classId ? (
                <div className="text-green-700">Klassen-ID: {parsedIds.classId} ✓</div>
              ) : (
                <div className="text-yellow-700">Klassen-ID: fehlt – Klassen werden abgerufen</div>
              )}
            </div>
          )}

          {/* Class selector (shown when URL has no classId) */}
          {availableClasses && !parsedIds?.classId && (
            <div>
              <label className="mb-1 block text-sm font-medium">Klasse auswählen</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-md border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— bitte wählen —</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {/420/.test(c.name) ? " ⚓" : ""}
                  </option>
                ))}
              </select>
              {selectedClassId && /420/.test(availableClasses.find((c) => c.id === selectedClassId)?.name ?? "") && (
                <p className="mt-1 text-xs text-blue-700">
                  420er-Klasse automatisch vorausgewählt.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleApiFetch}
            disabled={
              loading ||
              !parsedIds ||
              (availableClasses != null && !parsedIds?.classId && !selectedClassId)
            }
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Wird abgerufen…"
              : availableClasses && !parsedIds?.classId
              ? selectedClassId
                ? "Ergebnisse abrufen →"
                : "Bitte Klasse auswählen"
              : parsedIds?.classId
              ? "Ergebnisse abrufen →"
              : "Klassen laden →"}
          </button>
        </div>
      )}

      {/* ── Paste tab ───────────────────────────────────────────────────────── */}
      {tab === "paste" && (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">Manage2Sail Ergebnisseite kopieren</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Auf manage2sail.com: Ergebnisseite öffnen → Tabelle komplett markieren
              (Strg+A) → kopieren (Strg+C) → hier einfügen
            </p>
            <textarea
              className="input h-48 resize-y font-mono text-xs"
              placeholder={"Nr\tSegel Nummer\n1\n  GER 57211\n…"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Wird geparst…" : "Weiter →"}
          </button>
        </div>
      )}

      {/* ── PDF tab ─────────────────────────────────────────────────────────── */}
      {tab === "pdf" && (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">PDF-Ergebnisblatt hochladen</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Unterstützte Formate:{" "}
              <strong>Manage2Sail</strong>, <strong>Sailwave</strong>,{" "}
              <strong>SailResults</strong>, <strong>Velaware</strong>{" "}
              (automatische Erkennung)
            </p>

            <div
              className="cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.name.toLowerCase().endsWith(".pdf")) {
                  setPdfFile(f);
                  setError(null);
                } else {
                  setError("Bitte nur PDF-Dateien hochladen.");
                }
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setPdfFile(f); setError(null); }
                }}
              />
              {pdfFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{pdfFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pdfFile.size / 1024).toFixed(0)} KB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="mt-1 text-xs text-red-500 underline hover:text-red-700"
                  >
                    Datei entfernen
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl">📄</p>
                  <p className="text-sm text-muted-foreground">
                    PDF hier ablegen oder{" "}
                    <span className="text-blue-600 underline">auswählen</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {detectedFormat && (
            <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Format erkannt: <strong>{formatLabel[detectedFormat] ?? detectedFormat}</strong>
            </p>
          )}

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handlePdfSubmit}
            disabled={loading || !pdfFile}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "PDF wird verarbeitet…" : "Weiter →"}
          </button>
        </div>
      )}
    </div>
  );
}
