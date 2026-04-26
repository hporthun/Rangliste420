"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteRegatta } from "@/lib/actions/regattas";

type Props = {
  id: string;
  entryCount: number;
};

export function DeleteRegattaButton({ id, entryCount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRegatta(id);
      if (result.ok) {
        router.push("/admin/regatten");
      } else {
        setError(typeof result.error === "string" ? result.error : "Unbekannter Fehler");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {entryCount > 0
              ? `${entryCount} Einträge inkl. aller Ergebnisse werden unwiderruflich gelöscht.`
              : "Regatta unwiderruflich löschen?"}
          </p>
          {entryCount > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            {isPending ? "Löschen…" : "Ja, löschen"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
