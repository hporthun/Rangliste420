import { db } from "@/lib/db/client";
import Link from "next/link";

type Props = { searchParams: Promise<{ year?: string }> };

const typeLabel: Record<string, string> = {
  JAHRESRANGLISTE: "Jahresrangliste",
  IDJM:            "IDJM-Quali",
  JWM_QUALI:       "JWM/JEM-Quali",
  JEM_QUALI:       "JEM-Quali",
};

const typeBadgeClass: Record<string, string> = {
  JAHRESRANGLISTE: "bg-blue-50 text-blue-700 border-blue-200",
  IDJM:            "bg-amber-50 text-amber-800 border-amber-200",
  JWM_QUALI:       "bg-purple-50 text-purple-700 border-purple-200",
  JEM_QUALI:       "bg-purple-50 text-purple-700 border-purple-200",
};

const QUALI_TYPES = new Set(["IDJM", "JWM_QUALI", "JEM_QUALI"]);

export default async function RanglisteIndexPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;

  const rankings = await db.ranking.findMany({
    where: { isPublic: true },
    orderBy: [{ seasonEnd: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      publishedAt: true,
    },
  });

  // Collect all season years (from seasonEnd = Stichtag)
  const years = [
    ...new Set(rankings.map((r) => r.seasonEnd.getFullYear())),
  ].sort((a, b) => b - a);

  const latestYear = years[0] ?? new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : latestYear;

  const yearRankings = rankings.filter(
    (r) => r.seasonEnd.getFullYear() === selectedYear
  );

  const ranglisten = yearRankings.filter((r) => !QUALI_TYPES.has(r.type));
  const qualilisten = yearRankings.filter((r) => QUALI_TYPES.has(r.type));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 px-6 py-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">420er Ranglisten</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          Inoffizielle Ranglisten der 420er-Klassenvereinigung, berechnet nach DSV-Ranglistenordnung
          (gültig ab 01.01.2026).
        </p>
      </div>

      {rankings.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">Noch keine Ranglisten veröffentlicht.</p>
        </div>
      ) : (
        <>
          {/* Season tabs */}
          {years.length > 1 && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit max-w-full overflow-x-auto">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/rangliste?year=${y}`}
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

          {yearRankings.length === 0 ? (
            <div className="rounded-lg border bg-card px-6 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Keine Ranglisten für {selectedYear} veröffentlicht.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ranglisten */}
              {ranglisten.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-base font-semibold">Ranglisten</h2>
                  <RankingList items={ranglisten} />
                </section>
              )}

              {/* Qualifikationsranglisten */}
              {qualilisten.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-base font-semibold">Qualifikationsranglisten</h2>
                  <RankingList items={qualilisten} />
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RankingItem = {
  id: string;
  name: string;
  type: string;
  ageCategory: string;
  genderCategory: string;
  publishedAt: Date | null;
};

function RankingList({ items }: { items: RankingItem[] }) {
  return (
    <div className="rounded-lg border overflow-hidden shadow-sm divide-y divide-border/60">
      {items.map((r) => (
        <Link
          key={r.id}
          href={`/rangliste/${r.id}`}
          className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/40 transition-colors group"
        >
          <div className="space-y-1.5 min-w-0">
            <p className="font-medium text-sm leading-tight">{r.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${
                  typeBadgeClass[r.type] ?? "bg-muted text-muted-foreground border-border"
                }`}
              >
                {typeLabel[r.type] ?? r.type}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.ageCategory} / {r.genderCategory}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 ml-4">
            {r.publishedAt && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                {r.publishedAt.toLocaleDateString("de-DE")}
              </p>
            )}
            <span className="text-accent text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity">
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
