"use client";

import { useState, useTransition } from "react";
import { parseRegattaList, type ParsedRegattaRow } from "@/lib/import/parse-regatta-list";
import {
  importRegattenAction,
  fetchM2SRegattaListAction,
  type ImportRegattaRow,
} from "@/lib/actions/regattas";
import type { M2SRegattaCandidate } from "@/lib/import/manage2sail-api";

type Source = "m2s" | "paste";

type RowState = ParsedRegattaRow & {
  isRanglistenRegatta: boolean;
  include: boolean;
  sourceUrl?: string;
};

function toDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE");
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export function RegattaListImport() {
  const [source, setSource] = useState<Source>("m2s");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // M2S fetch state
  const [year, setYear] = useState(CURRENT_YEAR);
  const [fetchingM2S, setFetchingM2S] = useState(false);

  function reset() {
    setRows(null);
    setParseError(null);
    setResult(null);
    setError(null);
  }

  // ── paste ──────────────────────────────────────────────────────────────────

  function handlePaste() {
    reset();
    const { rows: parsed, skipped } = parseRegattaList(text);
    if (parsed.length === 0) {
      setParseError(
        skipped > 0
          ? `${skipped} Zeile(n) konnten nicht gelesen werden. Bitte Format prüfen.`
          : "Keine Zeilen erkannt. Bitte Text einfügen."
      );
      return;
    }
    setRows(parsed.map((r) => ({ ...r, isRanglistenRegatta: true, include: true })));
    if (skipped > 0) setParseError(`Hinweis: ${skipped} Zeile(n) übersprungen.`);
  }

  // ── M2S fetch ──────────────────────────────────────────────────────────────

  async function handleM2SFetch() {
    reset();
    setFetchingM2S(true);
    const res = await fetchM2SRegattaListAction(year);
    setFetchingM2S(false);
    if (!res.ok) { setParseError(res.error); return; }
    const candidates: M2SRegattaCandidate[] = res.candidates;
    setRows(
      candidates.map((c) => ({
        ...c,
        isRanglistenRegatta: true,
        include: true,
      }))
    );
  }

  // ── row helpers ────────────────────────────────────────────────────────────

  function toggle<K extends keyof RowState>(index: number, field: K) {
    setRows((prev) =>
      prev!.map((r, i) => (i === index ? { ...r, [field]: !r[field] } : r))
    );
  }

  function setField<K extends keyof RowState>(
    index: number,
    field: K,
    value: RowState[K]
  ) {
    setRows((prev) =>
      prev!.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function toggleAll(include: boolean) {
    setRows((prev) => prev!.map((r) => ({ ...r, include })));
  }

  // ── import ─────────────────────────────────────────────────────────────────

  function handleImport() {
    if (!rows) return;
    const toImport: ImportRegattaRow[] = rows
      .filter((r) => r.include)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ include: _include, ...r }) => r);

    if (toImport.length === 0) {
      setError("Keine Regatten zum Importieren ausgewählt.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await importRegattenAction(toImport);
      if (!res.ok) { setError(res.error); return; }
      setResult(
        res.skipped > 0
          ? `${res.created} Regatta(en) importiert, ${res.skipped} bereits vorhanden (übersprungen).`
          : `${res.created} Regatta(en) erfolgreich importiert.`
      );
      setRows(null);
      setText("");
    });
  }

  const includedCount = rows?.filter((r) => r.include).length ?? 0;
  const withUrl = rows?.filter((r) => r.include && r.sourceUrl).length ?? 0;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Source switcher */}
      {!rows && (
        <div className="flex w-fit gap-1 rounded-md bg-muted p-1 mb-2">
          {(["m2s", "paste"] as Source[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSource(s); reset(); }}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                source === s
                  ? "bg-background font-medium text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "m2s" ? "Manage2Sail" : "Text einfügen"}
            </button>
          ))}
        </div>
      )}

      {/* ── M2S tab ── */}
      {!rows && source === "m2s" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Regatten direkt aus der Manage2Sail-Klassenvereinigungsseite laden.
            Wähle das Jahr und klicke auf Laden.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Jahr</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleM2SFetch}
              disabled={fetchingM2S}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {fetchingM2S ? "Wird geladen…" : "Regatten laden →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Paste tab ── */}
      {!rows && source === "paste" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Format (Tab-getrennt):{" "}
            <code className="bg-muted px-1 rounded">
              DD.MM.YYYY - DD.MM.YYYY · Name · Klasse · Land · Faktor · Wettfahrten
            </code>
          </p>
          <textarea
            className="w-full h-56 font-mono text-xs border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              "12.02.2026 - 15.02.2026\tCarnival Race 2026\t420\tGER\t1,20\t5\n" +
              "07.03.2026 - 08.03.2026\tAuftaktregatta | LJM 420er\t420\tGER\t1,20\t5"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={handlePaste}
            disabled={!text.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Vorschau laden
          </button>
        </div>
      )}

      {parseError && (
        <p className="text-sm text-amber-700 border border-amber-200 bg-amber-50 rounded px-3 py-2">
          {parseError}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2">
          {result}
        </p>
      )}

      {/* ── Preview table ── */}
      {rows && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {rows.length} erkannt · {includedCount} ausgewählt
              {withUrl > 0 && (
                <span className="ml-2 text-blue-600">· {withUrl} mit M2S-Link</span>
              )}
            </span>
            <button
              onClick={() => toggleAll(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              Alle auswählen
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Alle abwählen
            </button>
            <button
              onClick={() => { reset(); }}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Neu laden
            </button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-gray-50 text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-center w-8">✓</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Von</th>
                  <th className="px-3 py-2 text-left">Bis</th>
                  <th className="px-3 py-2 text-center">Tage</th>
                  <th className="px-3 py-2 text-left">Land</th>
                  <th className="px-3 py-2 text-center">Faktor</th>
                  <th className="px-3 py-2 text-center">WF</th>
                  <th className="px-3 py-2 text-center" title="Mehrtages-Ausschreibung">
                    Multi
                  </th>
                  <th className="px-3 py-2 text-center" title="Ranglistenregatta">
                    RL
                  </th>
                  <th className="px-3 py-2 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i} className={row.include ? "" : "opacity-40"}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={() => toggle(i, "include")}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2">{toDateLabel(row.startDate)}</td>
                    <td className="px-3 py-2">{toDateLabel(row.endDate)}</td>
                    <td className="px-3 py-2 text-center">{row.numDays}</td>
                    <td className="px-3 py-2">{row.country}</td>
                    <td className="px-3 py-2 text-center font-mono">
                      {row.ranglistenFaktor.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={row.completedRaces}
                        onChange={(e) =>
                          setField(i, "completedRaces", parseInt(e.target.value, 10) || 0)
                        }
                        className="w-14 text-center border rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.multiDayAnnouncement}
                        onChange={() => toggle(i, "multiDayAnnouncement")}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.isRanglistenRegatta}
                        onChange={() => toggle(i, "isRanglistenRegatta")}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.sourceUrl ? (
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title={row.sourceUrl}
                        >
                          M2S
                        </a>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            WF = absolvierte Wettfahrten (0 = noch nicht gesegelt). Multi = Mehrtages-Ausschreibung.
            RL = Ranglistenregatta. Link = Manage2Sail-Ergebnisseite.
          </p>

          <button
            onClick={handleImport}
            disabled={isPending || includedCount === 0}
            className="px-4 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50"
          >
            {isPending
              ? "Wird importiert…"
              : `${includedCount} Regatta${includedCount !== 1 ? "en" : ""} importieren`}
          </button>
        </div>
      )}
    </div>
  );
}
