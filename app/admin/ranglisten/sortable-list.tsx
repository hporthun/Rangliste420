"use client";

import { useRef, useState, useTransition } from "react";
import { PublishToggle } from "./publish-toggle";
import { RankingActions } from "./ranking-actions";
import { updateRankingsSortOrderAction } from "@/lib/actions/rankings";

type RankingRow = {
  id: string;
  name: string;
  type: string;
  ageCategory: string;
  genderCategory: string;
  seasonStart: Date;
  seasonEnd: Date;
  isPublic: boolean;
  sortOrder: number;
};

const TYPE_LABELS: Record<string, string> = {
  JAHRESRANGLISTE: "Jahresrangliste",
  IDJM:            "IDJM-Quali",
  JWM_QUALI:       "JWM-Quali",
  JEM_QUALI:       "JEM-Quali",
};

export function RankingsSortableList({ initialRows }: { initialRows: RankingRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();
  const dragIdx = useRef<number | null>(null);

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;

    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  }

  function onDrop() {
    if (dragIdx.current === null) return;
    dragIdx.current = null;

    const updates = rows.map((r, i) => ({ id: r.id, sortOrder: i }));
    startTransition(async () => {
      await updateRankingsSortOrderAction(updates);
    });
  }

  return (
    <div className="rounded-md border overflow-x-auto" data-tour="ranglisten-tabelle">
      <table className="w-full text-sm min-w-[360px]">
        <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-2 py-2 w-8"></th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left hidden sm:table-cell">Typ</th>
            <th className="px-4 py-2 text-left hidden sm:table-cell">Saison</th>
            <th className="px-4 py-2 text-left hidden md:table-cell">Kategorie</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2"></th>
            <th className="px-4 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, idx) => (
            <tr
              key={r.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={onDrop}
              className="cursor-default"
            >
              <td className="px-2 py-2 text-muted-foreground cursor-grab active:cursor-grabbing select-none text-center">
                ⠿
              </td>
              <td className="px-4 py-2 font-medium">{r.name}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">
                {TYPE_LABELS[r.type] ?? r.type}
              </td>
              <td className="px-4 py-2 text-xs hidden sm:table-cell">
                {r.seasonStart.getFullYear()}
                {r.seasonStart.getFullYear() !== r.seasonEnd.getFullYear()
                  ? "/" + r.seasonEnd.getFullYear()
                  : ""}
              </td>
              <td className="px-4 py-2 text-xs hidden md:table-cell">
                {r.ageCategory} / {r.genderCategory}
              </td>
              <td className="px-4 py-2">
                <PublishToggle id={r.id} isPublic={r.isPublic} />
              </td>
              <RankingActions id={r.id} name={r.name} type={r.type} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
