"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTeamEntryAction } from "@/lib/actions/team-entries";

type Props = {
  teamEntryId: string;
  helmName: string;
};

export function DeleteTeamEntryButton({ teamEntryId, helmName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTeamEntryAction(teamEntryId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-[11px] text-red-600 whitespace-nowrap">
          {helmName} löschen?
        </span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="px-1.5 py-0.5 text-[11px] border rounded hover:bg-muted disabled:opacity-50"
        >
          Nein
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="px-1.5 py-0.5 text-[11px] bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium"
        >
          {pending ? "…" : "Ja"}
        </button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`${helmName} löschen`}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
