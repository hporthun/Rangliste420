import { db } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

function dateRange(start: Date, end: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const year = end.getFullYear();
  if (start.getTime() === end.getTime())
    return start.toLocaleDateString("de-DE");
  return `${fmt(start)}. – ${fmt(end)}. ${year}`;
}

export default async function RanglisteRegatttenPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  const isSignedIn = !!session?.user;

  // Drafts (isPublic=false) sind fuer angemeldete Benutzer einsehbar,
  // anonyme Aufrufe sehen 404 — gleiche Regel wie auf der Detailseite.
  const ranking = await db.ranking.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      seasonStart: true,
      seasonEnd: true,
      isPublic: true,
      rankingRegattas: { select: { regattaId: true } },
    },
  });

  if (!ranking) notFound();
  if (!ranking.isPublic && !isSignedIn) notFound();

  const isJwmJem =
    ranking.type === "JWM_QUALI" || ranking.type === "JEM_QUALI";

  // For JWM/JEM Quali use the explicitly linked regattas;
  // for DSV rankings use all Ranglistenregatten within the season window.
  const regattas = isJwmJem
    ? await db.regatta.findMany({
        where: { id: { in: ranking.rankingRegattas.map((r) => r.regattaId) } },
        orderBy: { startDate: "asc" },
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
      })
    : await db.regatta.findMany({
        where: {
          isRanglistenRegatta: true,
          startDate: {
            gte: ranking.seasonStart,
            lte: ranking.seasonEnd,
          },
        },
        orderBy: { startDate: "asc" },
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/rangliste" className="hover:text-foreground transition-colors">
          Ranglisten
        </Link>
        <span>›</span>
        <Link href={`/rangliste/${id}`} className="hover:text-foreground transition-colors">
          {ranking.name}
        </Link>
        <span>›</span>
        <span className="text-foreground">Regatten</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Verwendete Regatten</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{ranking.name}</p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
              <th className="px-4 py-2.5 text-left">Regatta</th>
              <th className="px-4 py-2.5 text-left">Datum</th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">Land</th>
              <th className="px-4 py-2.5 text-right hidden md:table-cell">Boote</th>
              <th className="px-4 py-2.5 text-right hidden sm:table-cell">WF</th>
              <th className="px-4 py-2.5 text-right">f</th>
              <th className="px-4 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {regattas.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40 transition-colors group">
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
                <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap">
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
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                  {r._count.teamEntries}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
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
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Keine Regatten gefunden.
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
