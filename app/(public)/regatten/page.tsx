import { db } from "@/lib/db/client";
import Link from "next/link";

type Props = { searchParams: Promise<{ year?: string }> };

function dateRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const year = end.getFullYear();
  if (start.getTime() === end.getTime()) return `${start.toLocaleDateString("de-DE")}`;
  return `${fmt(start)}. – ${fmt(end)}. ${year}`;
}

export default async function RegatttenPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;

  // Distinct years from DB
  const allDates = await db.regatta.findMany({
    where: { isRanglistenRegatta: true },
    select: { startDate: true },
  });
  const years = [
    ...new Set(allDates.map((r) => r.startDate.getFullYear())),
  ].sort((a, b) => b - a);

  const currentYear = years[0] ?? new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;

  const regattas = await db.regatta.findMany({
    where: {
      isRanglistenRegatta: true,
      startDate: {
        gte: new Date(selectedYear, 0, 1),
        lte: new Date(selectedYear, 11, 31, 23, 59, 59),
      },
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      country: true,
      startDate: true,
      endDate: true,
      completedRaces: true,
      ranglistenFaktor: true,
      multiDayAnnouncement: true,
      _count: { select: { teamEntries: true } },
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Ranglistenregatten</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Alle Regatten, die in die Berechnung der 420er-Rangliste einfließen.
        </p>
      </div>

      {/* Year tabs */}
      {years.length > 1 && (
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {years.map((y) => (
            <Link
              key={y}
              href={`/regatten?year=${y}`}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                y === selectedYear
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
              <th className="px-4 py-2.5 text-left">Regatta</th>
              <th className="px-4 py-2.5 text-left">Datum</th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">Land</th>
              <th className="px-4 py-2.5 text-right">Boote</th>
              <th className="px-4 py-2.5 text-right">WF</th>
              <th className="px-4 py-2.5 text-right">f</th>
              <th className="px-4 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {regattas.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-muted/40 transition-colors group"
              >
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    href={`/regatta/${r.id}`}
                    className="hover:text-accent transition-colors"
                  >
                    {r.name}
                    {r.multiDayAnnouncement && (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground border rounded px-1 py-0.5 align-middle">
                        Multi
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                  {dateRange(r.startDate, r.endDate)}
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {r.country === "GER" ? (
                    <span className="text-xs text-muted-foreground">GER</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      {r.country}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r._count.teamEntries}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.completedRaces > 0 ? r.completedRaces : <span className="text-border">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-medium">
                  {Number(r.ranglistenFaktor).toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/regatta/${r.id}`}
                    className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Details zu ${r.name}`}
                  >
                    →
                  </Link>
                </td>
              </tr>
            ))}
            {regattas.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground text-sm"
                >
                  Keine Ranglistenregatten für {selectedYear} vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {regattas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {regattas.length} Regatta{regattas.length !== 1 ? "en" : ""} · WF = absolvierte Wettfahrten · f = Ranglistenfaktor
        </p>
      )}
    </div>
  );
}
