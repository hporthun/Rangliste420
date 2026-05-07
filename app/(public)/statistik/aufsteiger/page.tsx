import Link from "next/link";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { calculateRAForResult } from "@/lib/scoring/dsv";
import { linearTrend, trendLine } from "@/lib/stats/trend";
import { Sparkline } from "@/components/charts/sparkline";

type Props = { searchParams: Promise<{ jahr?: string }> };

export const metadata = {
  title: "Aufsteiger · Statistik · 420er Rangliste",
  description: "Steuerleute mit dem stärksten positiven R_A-Trend einer Saison.",
};

const MIN_REGATTAS = 4;
const TOP_N = 15;

type HelmRA = {
  helmId: string;
  helmName: string;
  /** R_A-Werte chronologisch (älteste zuerst). */
  series: number[];
};

export default async function AufsteigerPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) {
    return <SignInGate />;
  }

  const { jahr: yearParam } = await searchParams;

  // Distinct Saison-Jahre aus den Ranglistenregatten mit Ergebnissen.
  const allDates = await db.regatta.findMany({
    where: { isRanglistenRegatta: true, teamEntries: { some: {} } },
    select: { startDate: true },
  });
  const years = [...new Set(allDates.map((r) => r.startDate.getFullYear()))].sort(
    (a, b) => b - a,
  );
  const latestYear = years[0] ?? new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : latestYear;

  // Alle Ranglistenregatten + Results, chronologisch. Saison-Filter erfolgt
  // in JS — Prisma-Range-Filter auf startDate greift mit dem aktuellen
  // SQLite/PostgreSQL-Driver-Adapter nicht zuverlässig.
  const allRegattas = await db.regatta.findMany({
    where: { isRanglistenRegatta: true },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      ranglistenFaktor: true,
      totalStarters: true,
      results: {
        select: {
          finalRank: true,
          inStartArea: true,
          teamEntry: {
            select: {
              helm: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  const regattas = allRegattas.filter(
    (r) => r.startDate.getFullYear() === selectedYear,
  );

  // Pro Helm: chronologische R_A-Serie. Pro Regatta zählt ein einziger R_A —
  // anders als in der DSV-Engine, die für die 9-besten-Wertung den
  // Multiplikator m-fach einfügt. Für die Trend-Regression wäre das eine
  // unerwünschte Verdopplung von Datenpunkten.
  const byHelm = new Map<string, HelmRA>();
  for (const reg of regattas) {
    const f = Number(reg.ranglistenFaktor);
    const s = reg.totalStarters ?? reg.results.length;
    if (s === 0) continue;
    for (const result of reg.results) {
      const rA = calculateRAForResult(f, s, result);
      if (rA == null) continue;
      const helm = result.teamEntry.helm;
      const id = helm.id;
      const existing = byHelm.get(id);
      if (existing) {
        existing.series.push(rA);
      } else {
        byHelm.set(id, {
          helmId: id,
          helmName: `${helm.firstName} ${helm.lastName}`.trim(),
          series: [rA],
        });
      }
    }
  }

  type Row = HelmRA & {
    slope: number;
    intercept: number;
    r2: number;
  };

  const rows: Row[] = [];
  for (const helm of byHelm.values()) {
    if (helm.series.length < MIN_REGATTAS) continue;
    const t = linearTrend({ values: helm.series });
    rows.push({ ...helm, slope: t.slope, intercept: t.intercept, r2: t.r2 });
  }

  // Sortierung: Aufsteiger zuerst (Slope desc). Tie-Break: höheres R²,
  // dann mehr Datenpunkte, dann Name.
  rows.sort((a, b) => {
    if (b.slope !== a.slope) return b.slope - a.slope;
    if (b.r2 !== a.r2) return b.r2 - a.r2;
    if (b.series.length !== a.series.length) return b.series.length - a.series.length;
    return a.helmName.localeCompare(b.helmName, "de");
  });

  const top = rows.slice(0, TOP_N);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-muted-foreground mb-1">
          <Link href="/statistik" className="hover:text-foreground transition-colors">
            ← Zurück zur Statistik
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Aufsteiger der Saison</h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
          Steuerleute mit dem stärksten positiven R_A-Trend innerhalb einer Saison.
          Berechnet als lineare Regression über die chronologisch geordneten R_A-Werte.
          Mindestens {MIN_REGATTAS} Regatten erforderlich. R² zeigt die Konsistenz
          des Trends (1 = perfekt linear, 0 = stark verrauscht).
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Nur für angemeldete Benutzer sichtbar.
        </p>
      </div>

      {years.length > 1 && (
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit max-w-full overflow-x-auto">
          {years.map((y) => (
            <Link
              key={y}
              href={`/statistik/aufsteiger?jahr=${y}`}
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

      {top.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Für {selectedYear} gibt es noch keine Steuerleute mit mindestens
          {" "}{MIN_REGATTAS} Wertungen.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left w-10">#</th>
                <th className="px-4 py-2.5 text-left">Steuermann</th>
                <th className="px-4 py-2.5 text-left">Verlauf</th>
                <th className="px-4 py-2.5 text-right">Slope</th>
                <th className="px-4 py-2.5 text-right">R²</th>
                <th className="px-4 py-2.5 text-right">n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {top.map((row, i) => {
                const line = trendLine(row.intercept, row.slope, row.series.length);
                const slopeClass =
                  row.slope > 0
                    ? "text-emerald-700"
                    : row.slope < 0
                      ? "text-red-700"
                      : "text-muted-foreground";
                return (
                  <tr key={row.helmId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {i + 1}.
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.helmName}</td>
                    <td className="px-4 py-2.5">
                      <Sparkline
                        values={row.series}
                        trendLine={line}
                        ariaLabel={`R_A-Verlauf von ${row.helmName} über ${row.series.length} Regatten`}
                      />
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${slopeClass}`}
                    >
                      {row.slope > 0 ? "+" : ""}
                      {row.slope.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.r2.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.series.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Slope = Veränderung des R_A-Werts pro Regatta-Index. Positiv = steigend.
      </p>
    </div>
  );
}

function SignInGate() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Aufsteiger der Saison</h1>
      <div className="rounded-lg border bg-card px-6 py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Diese Auswertung ist nur für angemeldete Benutzer sichtbar.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Zum Login
        </Link>
      </div>
    </div>
  );
}
