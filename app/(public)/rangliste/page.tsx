import { db } from "@/lib/db/client";
import Link from "next/link";

export default async function RanglisteIndexPage() {
  const rankings = await db.ranking.findMany({
    where: { isPublic: true },
    orderBy: { publishedAt: "desc" },
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

  const typeLabel: Record<string, string> = {
    JAHRESRANGLISTE: "Jahresrangliste",
    JWM_QUALI: "JWM-Quali",
    JEM_QUALI: "JEM-Quali",
  };

  const typeBadge: Record<string, string> = {
    JAHRESRANGLISTE: "bg-blue-50 text-blue-700 border-blue-200",
    JWM_QUALI: "bg-purple-50 text-purple-700 border-purple-200",
    JEM_QUALI: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">420er Ranglisten</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Veröffentlichte Ranglisten der 420er-Klassenvereinigung.
        </p>
      </div>

      {rankings.length === 0 ? (
        <div className="sea-card px-6 py-10 text-center text-muted-foreground text-sm">
          Noch keine Ranglisten veröffentlicht.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm divide-y divide-border/60">
          {rankings.map((r) => (
            <Link
              key={r.id}
              href={`/rangliste/${r.id}`}
              className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/40 transition-colors group"
            >
              <div className="space-y-1 min-w-0">
                <p className="font-medium text-sm">{r.name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${
                      typeBadge[r.type] ?? "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {typeLabel[r.type] ?? r.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.ageCategory} / {r.genderCategory}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Saison {r.seasonStart.getFullYear()}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {r.publishedAt?.toLocaleDateString("de-DE") ?? "—"}
                </p>
                <p className="text-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
