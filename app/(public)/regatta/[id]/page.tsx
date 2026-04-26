import { db } from "@/lib/db/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { calculateRA } from "@/lib/scoring/dsv";

type Props = { params: Promise<{ id: string }> };

export default async function RegattaDetailPage({ params }: Props) {
  const { id } = await params;

  const regatta = await db.regatta.findUnique({
    where: { id },
    include: {
      results: {
        orderBy: { finalRank: "asc" },
        include: {
          teamEntry: {
            include: {
              helm: { select: { id: true, firstName: true, lastName: true, nationality: true } },
              crew: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!regatta) notFound();

  const f = Number(regatta.ranglistenFaktor);
  const s = regatta.results.length;

  function dateRange(start: Date, end: Date) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (start.toDateString() === end.toDateString()) return fmt(start);
    return `${start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}. – ${fmt(end)}`;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/regatten?year=${regatta.startDate.getFullYear()}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Alle Regatten {regatta.startDate.getFullYear()}
      </Link>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{regatta.name}</h1>
        <p className="text-sm text-muted-foreground">
          {dateRange(regatta.startDate, regatta.endDate)}
          {regatta.country !== "GER" && (
            <span className="ml-2 text-amber-700 font-medium">{regatta.country}</span>
          )}
        </p>
        {regatta.sourceUrl && (
          <a
            href={regatta.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
          >
            Manage2Sail ↗
          </a>
        )}
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Starter s", value: String(s) },
          { label: "Wettfahrten", value: String(regatta.completedRaces) },
          { label: "Faktor f", value: f.toFixed(2), mono: true },
          { label: "Rangliste", value: regatta.isRanglistenRegatta ? "Ja" : "Nein" },
        ].map(({ label, value, mono }) => (
          <div key={label} className="sea-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              {label}
            </p>
            <p className={`text-lg font-semibold mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="rounded-lg border overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
              <th className="px-3 py-2.5 text-center w-12">Platz</th>
              <th className="px-3 py-2.5 text-left">Steuermann</th>
              <th className="px-3 py-2.5 text-left">Vorschoter</th>
              <th className="px-3 py-2.5 text-right">Punkte</th>
              <th className="px-3 py-2.5 text-right">R_A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {regatta.results.map((r) => {
              const rA =
                r.inStartArea && r.finalRank == null
                  ? 0
                  : r.finalRank != null
                  ? calculateRA({ f, s, x: r.finalRank })
                  : null;
              return (
                <tr
                  key={r.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    r.inStartArea ? "bg-amber-50/60" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 text-center font-medium tabular-nums">
                    {r.finalRank ?? (
                      <span className="text-amber-600 text-xs font-semibold">SG</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {r.teamEntry.helm.firstName} {r.teamEntry.helm.lastName}
                    {r.teamEntry.helm.nationality !== "GER" && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        ({r.teamEntry.helm.nationality})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {r.teamEntry.crew
                      ? `${r.teamEntry.crew.firstName} ${r.teamEntry.crew.lastName}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {r.finalPoints != null ? Number(r.finalPoints).toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {rA != null ? rA.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
            {regatta.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Noch keine Ergebnisse importiert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        R_A = f × 100 × ((s + 1 − x) / s) = {f.toFixed(2)} × 100 × (({s} + 1 − x) / {s}).
        SG = nur Startgebiet, R_A = 0.
      </p>
    </div>
  );
}
