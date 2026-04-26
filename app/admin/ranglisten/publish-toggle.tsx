"use client";

import { useState } from "react";
import { publishRankingAction } from "@/lib/actions/rankings";

type Props = { id: string; isPublic: boolean };

export function PublishToggle({ id, isPublic }: Props) {
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState(isPublic);

  async function toggle() {
    setPending(true);
    const result = await publishRankingAction(id, !current);
    if (result.ok) setCurrent((v) => !v);
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`text-xs px-2 py-0.5 rounded border ${
        current
          ? "border-green-300 text-green-700 hover:bg-green-50"
          : "border-gray-300 text-gray-500 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      {pending ? "…" : current ? "Veröffentlicht" : "Entwurf"}
    </button>
  );
}
