import { db } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { computeRankingAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

export default async function RanglistePage({ params }: Props) {
  const { id } = await params;

  const ranking = await db.ranking.findUnique({
    where: { id, isPublic: true },
    select: {
      id: true,
      name: true,
      type: true,
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      scoringRule: true,
    },
  });

  if (!ranking) notFound();

  const computeParams: ComputeParams = {
    type: ranking.type as RankingType,
    seasonStart: ranking.seasonStart.toISOString().slice(0, 10),
    referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    ageCategory: ranking.ageCategory as ComputeParams["ageCategory"],
    genderCategory: ranking.genderCategory as ComputeParams["genderCategory"],
  };

  const result = await computeRankingAction(computeParams);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href="/rangliste" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Ranglisten
        </Link>
        <h1 className="text-xl font-semibold">{ranking.name}</h1>
        <p className="text-sm text-red-600">Fehler: {result.error}</p>
      </div>
    );
  }

  const rows = result.data.rows;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/rangliste"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Ranglisten
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{ranking.name}</h1>
        <p className="text-sm text-muted-foreground">
          {ranking.ageCategory} / {ranking.genderCategory} ·{" "}
          Saison {ranking.seasonStart.getFullYear()} ·{" "}
          Stichtag {ranking.seasonEnd.toLocaleDateString("de-DE")}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
              <th className="px-4 py-2.5 text-center w-12">Platz</th>
              <th className="px-4 py-2.5 text-left">Name</th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">Verein</th>
              <th className="px-4 py-2.5 text-right">R</th>
              <th className="px-4 py-2.5 text-right hidden sm:table-cell">Wertungen</th>
              <th className="px-4 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {rows.map((row, idx) => (
              <tr key={row.helmId} className="hover:bg-muted/40 transition-colors group">
                <td className="px-4 py-3 text-center">
                  {idx === 0 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm">
                      1
                    </span>
                  ) : idx === 1 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-sm">
                      2
                    </span>
                  ) : idx === 2 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                      3
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium tabular-nums">{row.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {row.firstName} {row.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                  {row.club ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                  {row.R.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs tabular-nums hidden sm:table-cell">
                  {row.valuesCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/rangliste/${id}/steuermann/${row.helmId}`}
                    className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Details ${row.firstName} ${row.lastName}`}
                  >
                    →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Keine Segler mit ≥ 9 Wertungen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {rows.length} Segler · R = arithmetisches Mittel der 9 besten R_A-Werte
        </p>
      )}
    </div>
  );
}
