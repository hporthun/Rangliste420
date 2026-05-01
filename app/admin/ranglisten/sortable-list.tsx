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

const QUALI_TYPES = new Set(["IDJM", "JWM_QUALI", "JEM_QUALI"]);

const TYPE_LABELS: Record<string, string> = {
  JAHRESRANGLISTE: "Jahresrangliste",
  IDJM:            "IDJM-Quali",
  JWM_QUALI:       "JWM-Quali",
  JEM_QUALI:       "JEM-Quali",
};

export function RankingsSortableList({ initialRows }: { initialRows: RankingRow[] }) {
  const [ranglisten, setRanglisten] = useState(
    () => initialRows.filter((r) => !QUALI_TYPES.has(r.type))
  );
  const [qualilisten, setQualilisten] = useState(
    () => initialRows.filter((r) => QUALI_TYPES.has(r.type))
  );
  const [, startTransition] = useTransition();

  function persist(rl: RankingRow[], ql: RankingRow[]) {
    const updates = [
      ...rl.map((r, i) => ({ id: r.id, sortOrder: i })),
      ...ql.map((r, i) => ({ id: r.id, sortOrder: rl.length + i })),
    ];
    startTransition(async () => {
      await updateRankingsSortOrderAction(updates);
    });
  }

  return (
    <div className="space-y-6" data-tour="ranglisten-tabelle">
      {ranglisten.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Ranglisten</h2>
          <SortableTable
            rows={ranglisten}
            setRows={setRanglisten}
            onDrop={(updated) => persist(updated, qualilisten)}
          />
        </section>
      )}
      {qualilisten.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Qualifikationsranglisten</h2>
          <SortableTable
            rows={qualilisten}
            setRows={setQualilisten}
            onDrop={(updated) => persist(ranglisten, updated)}
          />
        </section>
      )}
    </div>
  );
}

function SortableTable({
  rows,
  setRows,
  onDrop,
}: {
  rows: RankingRow[];
  setRows: React.Dispatch<React.SetStateAction<RankingRow[]>>;
  onDrop: (rows: RankingRow[]) => void;
}) {
  const dragIdx = useRef<number | null>(null);

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;

    const from = dragIdx.current;
    dragIdx.current = idx;

    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
  }

  function handleDrop() {
    dragIdx.current = null;
    onDrop(rows);
  }

  return (
    <div className="rounded-md border overflow-x-auto">
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
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={handleDrop}
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
