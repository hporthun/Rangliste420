"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { deleteRankingAction, renameRankingAction } from "@/lib/actions/rankings";
import Link from "next/link";

export function RankingActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the rename input when mode switches
  useEffect(() => {
    if (mode === "rename") inputRef.current?.focus();
  }, [mode]);

  async function handleRename() {
    if (draft.trim() === name) { setMode("idle"); return; }
    setBusy(true);
    setError(null);
    const res = await renameRankingAction(id, draft);
    setBusy(false);
    if (res.ok) {
      setMode("idle");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await deleteRankingAction(id);
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error);
      setMode("idle");
    }
  }

  // ── Rename mode ────────────────────────────────────────────────────────────
  if (mode === "rename") {
    return (
      <td colSpan={2} className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") { setMode("idle"); setDraft(name); }
            }}
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm min-w-0"
          />
          <button
            type="button"
            onClick={handleRename}
            disabled={busy}
            title="Speichern"
            className="p-1 rounded hover:bg-green-50 text-green-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setMode("idle"); setDraft(name); }}
            disabled={busy}
            title="Abbrechen"
            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    );
  }

  // ── Delete confirm mode ────────────────────────────────────────────────────
  if (mode === "confirm-delete") {
    return (
      <td colSpan={2} className="px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-red-700 font-medium">Wirklich löschen?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Löschen"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={busy}
            className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    );
  }

  // ── Idle mode ──────────────────────────────────────────────────────────────
  return (
    <>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <Link
          href={`/rangliste/${id}`}
          className="text-xs text-blue-600 hover:underline mr-3"
        >
          Ansehen →
        </Link>
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setMode("rename")}
            title="Umbenennen"
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            title="Löschen"
            className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </>
  );
}
