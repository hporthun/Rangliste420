"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Repeat, Check, X, Loader2 } from "lucide-react";
import { setCrewSwapAction } from "@/lib/actions/team-entries";
import { useRouter } from "next/navigation";

type Props = {
  teamEntryId: string;
  /** Helm- and crew-name pre-formatted für den Dialog-Header. */
  helmName: string;
  crewName: string;
  /** Aktueller Status. */
  initialApproved: boolean;
  initialNote: string;
};

/**
 * Kleines Repeat-Icon neben jedem Crew-Eintrag in der Regatta-Tabelle.
 * Gelb/aktiviert wenn der Schottenwechsel bereits markiert ist, sonst grau.
 *
 * Klick öffnet ein Mini-Popover: Status togglen + Notiz pflegen + speichern.
 * Geöffnete Popover schließen sich beim Klick außerhalb (per global pointer-
 * down listener).
 *
 * Issue #11.
 */
export function CrewSwapToggle({
  teamEntryId,
  helmName,
  crewName,
  initialApproved,
  initialNote,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [approved, setApproved] = useState(initialApproved);
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Close on click-outside.
  useEffect(() => {
    if (!open) return;
    function handler(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await setCrewSwapAction({
        teamEntryId,
        approved,
        note: note.trim(),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={
          initialApproved
            ? `Genehmigter Schottenwechsel (JWM/JEM-Quali)${initialNote ? " — " + initialNote : ""}`
            : "Schottenwechsel markieren (relevant für JWM/JEM-Quali)"
        }
        aria-label={
          initialApproved
            ? "Schottenwechsel bearbeiten"
            : "Schottenwechsel markieren"
        }
        className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
          initialApproved
            ? "text-amber-700 bg-amber-100 hover:bg-amber-200"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <Repeat className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 right-0 w-72 rounded-md border bg-card shadow-xl p-3 space-y-2"
          // Stop click-inside from bubbling to router/links
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium pb-1 border-b">
            Schottenwechsel
          </div>
          <p className="text-xs text-muted-foreground">
            Steuermann <strong className="text-foreground">{helmName}</strong>
            {crewName && (
              <>
                {" "}mit Crew{" "}
                <strong className="text-foreground">{crewName}</strong>
              </>
            )}.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Hinweis: dieses Feld wirkt sich nur auf die <strong>JWM/JEM-Quali</strong>{" "}
            aus. DSV-Jahres-, Aktuelle- und IDJM-Rangliste ignorieren es.
          </p>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span>Schottenwechsel genehmigt</span>
          </label>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={`note-${teamEntryId}`}>
              Notiz (optional)
            </label>
            <textarea
              id={`note-${teamEntryId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="z.B. Genehmigung durch Wettfahrtleitung am 14.05.2026"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setApproved(initialApproved);
                setNote(initialNote);
                setError(null);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
              disabled={pending}
            >
              <X className="h-3 w-3" />
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {pending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Check className="h-3 w-3" />}
              Speichern
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
