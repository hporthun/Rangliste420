import Link from "next/link";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import {
  seasonOverview,
  topActiveHelms,
  topRaceHelms,
  factorHistogram,
  listYears,
  filterRegattas,
  type RegattaStat,
} from "@/lib/stats/aggregates";
import { BarChart, type BarDatum } from "@/components/charts/bar-chart";
import { StatsFilterBar } from "@/components/stats-filter-bar";
import { parseFilterParams } from "@/lib/stats/filter-params";

type Props = {
  searchParams: Promise<{ jahr?: string; alter?: string; gender?: string }>;
};

export const metadata = {
  title: "Statistik · 420er Rangliste",
  description:
    "Saisonübersicht, aktivste Steuerleute und Faktor-Verteilung der 420er-Ranglistenregatten.",
};

export default async function StatistikPage({ searchParams }: Props) {
  const sp = await searchParams;
  const yearParam = sp.jahr;
  const { age, gender } = parseFilterParams(sp);
  const session = await auth();
  const isSignedIn = !!session?.user;

  // Nur Regatten mit Meldungen. Future-Termine ohne TeamEntries würden die
  // Aggregate verzerren (z.B. "60 Regatten, 30 Wettfahrten" wenn 55 davon
  // noch nicht stattgefunden haben).
  const dbRegattas = await db.regatta.findMany({
    where: { isRanglistenRegatta: true, teamEntries: { some: {} } },
    select: {
      id: true,
      startDate: true,
      completedRaces: true,
      ranglistenFaktor: true,
      teamEntries: {
        select: {
          sailNumber: true,
          helm: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthYear: true,
              gender: true,
            },
          },
          crew: { select: { birthYear: true, gender: true } },
        },
      },
    },
  });

  const allRegattas: RegattaStat[] = dbRegattas.map((r) => ({
    id: r.id,
    year: r.startDate.getFullYear(),
    completedRaces: r.completedRaces,
    ranglistenFaktor: Number(r.ranglistenFaktor),
    teamEntries: r.teamEntries.map((te) => ({
      helmId: te.helm.id,
      helmFirstName: te.helm.firstName,
      helmLastName: te.helm.lastName,
      helmBirthYear: te.helm.birthYear,
      helmGender: te.helm.gender,
      crewBirthYear: te.crew?.birthYear ?? null,
      crewGender: te.crew?.gender ?? null,
      sailNumber: te.sailNumber,
    })),
  }));

  const regattas = filterRegattas(allRegattas, age, gender);

  // Years aus dem ungefilterten Datensatz, damit der Year-Switcher auch
  // dann alle Saisons zeigt, wenn die aktuelle Filterkombination eine
  // Saison leer macht.
  const years = listYears(allRegattas);
  const latestYear = years[0] ?? new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : latestYear;

  // Saison-Übersicht: nur die letzten 10 Jahre, sonst wird die x-Achse zu eng.
  const overviewAll = seasonOverview(regattas);
  const overview = overviewAll.slice(-10);

  const topRegattas = topActiveHelms(regattas, selectedYear, 10);
  const topRaces = topRaceHelms(regattas, selectedYear, 10);
  const histogram = factorHistogram(regattas, selectedYear);

  const regattaBars: BarDatum[] = overview.map((row) => ({
    label: String(row.year),
    value: row.regattaCount,
    title: `${row.year}: ${row.regattaCount} Regatten`,
  }));
  const raceBars: BarDatum[] = overview.map((row) => ({
    label: String(row.year),
    value: row.raceCount,
    title: `${row.year}: ${row.raceCount} Wettfahrten`,
  }));
  const helmBars: BarDatum[] = overview.map((row) => ({
    label: String(row.year),
    value: row.distinctHelms,
    title: `${row.year}: ${row.distinctHelms} verschiedene Steuerleute`,
  }));
  const factorBars: BarDatum[] = histogram.map((bin) => ({
    label: bin.binStart.toFixed(1),
    value: bin.count,
    title: `${bin.binStart.toFixed(1)}–${bin.binEnd.toFixed(1)}: ${bin.count} Regatten`,
  }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 px-6 py-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Statistik</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          Saison-Kennzahlen der 420er-Ranglistenregatten — Anzahl Regatten,
          Wettfahrten und aktive Steuerleute über die Jahre.
        </p>
        {isSignedIn && (
          <Link
            href={(() => {
              const params = new URLSearchParams();
              if (yearParam) params.set("jahr", yearParam);
              if (age !== "OPEN") params.set("alter", age);
              if (gender !== "OPEN") params.set("gender", gender);
              const qs = params.toString();
              return qs ? `/statistik/aufsteiger?${qs}` : "/statistik/aufsteiger";
            })()}
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-accent hover:underline"
          >
            Aufsteiger der Saison →
          </Link>
        )}
      </div>

      <StatsFilterBar
        action="/statistik"
        selectedYear={selectedYear}
        selectedAge={age}
        selectedGender={gender}
      />

      {regattas.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {age === "OPEN" && gender === "OPEN"
              ? "Noch keine Ranglistenregatten erfasst."
              : "Keine Daten für die gewählte Filterkombination."}
          </p>
        </div>
      ) : (
        <>
          {/* Saison-Übersicht: 3 Bar-Charts nebeneinander (auf Mobile gestapelt) */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Saison-Übersicht</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ChartCard title="Regatten">
                <BarChart
                  data={regattaBars}
                  ariaLabel="Anzahl Ranglistenregatten pro Jahr"
                />
              </ChartCard>
              <ChartCard title="Wettfahrten">
                <BarChart
                  data={raceBars}
                  ariaLabel="Anzahl Wettfahrten pro Jahr"
                  barClass="fill-[var(--chart-2)]"
                />
              </ChartCard>
              <ChartCard title="Steuerleute">
                <BarChart
                  data={helmBars}
                  ariaLabel="Anzahl unterschiedlicher Steuerleute pro Jahr"
                  barClass="fill-[var(--chart-3)]"
                />
              </ChartCard>
            </div>
          </section>

          {/* Year-Switcher für Top-Listen + Faktor-Histogramm */}
          {years.length > 1 && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit max-w-full overflow-x-auto">
              {years.map((y) => {
                const params = new URLSearchParams();
                params.set("jahr", String(y));
                if (age !== "OPEN") params.set("alter", age);
                if (gender !== "OPEN") params.set("gender", gender);
                return (
                  <Link
                    key={y}
                    href={`/statistik?${params.toString()}`}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      y === selectedYear
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {y}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Top-Listen */}
          <section className="grid gap-4 lg:grid-cols-2">
            <TopListCard
              title="Aktivste Steuerleute"
              subtitle="nach Anzahl bestrittener Regatten"
              rows={topRegattas}
              primaryKey="regattaCount"
              primaryLabel="Reg."
              year={selectedYear}
            />
            <TopListCard
              title="Meiste Wettfahrten"
              subtitle="Summe über alle Regatten"
              rows={topRaces}
              primaryKey="raceCount"
              primaryLabel="WF"
              year={selectedYear}
            />
          </section>

          {/* Faktor-Histogramm */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">
                Verteilung Ranglistenfaktor {selectedYear}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Wie viele Regatten wurden in welcher Faktor-Kategorie gesegelt
                (DSV-Wertebereich 0,80–2,60).
              </p>
            </div>
            <ChartCard>
              <BarChart
                data={factorBars}
                ariaLabel="Verteilung des Ranglistenfaktors"
                barClass="fill-[var(--chart-4)]"
                minBarWidth={48}
              />
            </ChartCard>
          </section>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TopListCard({
  title,
  subtitle,
  rows,
  primaryKey,
  primaryLabel,
  year,
}: {
  title: string;
  subtitle: string;
  rows: { helmId: string; name: string; regattaCount: number; raceCount: number }[];
  primaryKey: "regattaCount" | "raceCount";
  primaryLabel: string;
  year: number;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle} · {year}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground italic text-center">
          Keine Daten für {year}.
        </p>
      ) : (
        <ol className="divide-y divide-border/60">
          {rows.map((row, i) => {
            const secondary =
              primaryKey === "regattaCount" ? row.raceCount : row.regattaCount;
            const secondaryLabel = primaryKey === "regattaCount" ? "WF" : "Reg.";
            return (
              <li
                key={row.helmId}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors"
              >
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                  {i + 1}.
                </span>
                <span className="flex-1 truncate">{row.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {secondary}&nbsp;{secondaryLabel}
                </span>
                <span className="font-mono font-medium tabular-nums whitespace-nowrap">
                  {row[primaryKey]}&nbsp;{primaryLabel}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
