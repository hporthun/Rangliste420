import { db } from "@/lib/db/client";
import Link from "next/link";

const typeLabel: Record<string, string> = {
  JAHRESRANGLISTE: "Jahresrangliste",
  IDJM:            "IDJM-Quali",
  JWM_QUALI:       "JWM-Quali",
  JEM_QUALI:       "JEM-Quali",
};

const typeBadgeClass: Record<string, string> = {
  JAHRESRANGLISTE: "bg-blue-50 text-blue-700 border-blue-200",
  IDJM:            "bg-amber-50 text-amber-800 border-amber-200",
  JWM_QUALI:       "bg-purple-50 text-purple-700 border-purple-200",
  JEM_QUALI:       "bg-purple-50 text-purple-700 border-purple-200",
};

export default async function RanglisteIndexPage() {
  const rankings = await db.ranking.findMany({
    where: { isPublic: true },
    orderBy: [{ seasonStart: "desc" }, { publishedAt: "desc" }],
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

  // Group by season year
  const byYear = new Map<number, typeof rankings>();
  for (const r of rankings) {
    const year = r.seasonStart.getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(r);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 px-6 py-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">420er Ranglisten</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          Offizielle Ranglisten der 420er-Klassenvereinigung, berechnet nach DSV-Ranglistenordnung
          (gültig ab 01.01.2026).
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Jahresrangliste — gespeicherter Snapshot (Stichtag 30.11.)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            JWM/JEM-Quali — klassenspezifische Sonderregel
          </span>
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">Noch keine Ranglisten veröffentlicht.</p>
        </div>
      ) : (
        sortedYears.map((year) => (
          <div key={year} className="space-y-2">
            {/* Year header */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Saison {year}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Cards for this year */}
            <div className="rounded-lg border overflow-hidden shadow-sm divide-y divide-border/60">
              {byYear.get(year)!.map((r) => (
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
          </div>
        ))
      )}
    </div>
  );
}
