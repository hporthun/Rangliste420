import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/search-input";
import { YearSelect } from "@/components/year-select";
import { RegattaTableWithSync } from "@/components/admin/regatta-table-sync";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";

export const dynamic = "force-dynamic";

// ── Page-specific tour steps ──────────────────────────────────────────────────

const REGATTEN_TOUR: TourStep[] = [
  {
    id: "regatten-neu",
    target: '[data-tour="regatten-neu"]',
    title: "Neue Regatta anlegen",
    content:
      "Legt eine Regatta mit allen Pflichtfeldern an: Datum, Anzahl der Wettfahrten, " +
      "Ranglistenfaktor f (0,80–2,60) und ob sie als Ranglistenregatta zählt. " +
      "Der Faktor beeinflusst direkt alle R_A-Werte dieser Regatta.",
    placement: "bottom-end",
  },
  {
    id: "regatten-import",
    target: '[data-tour="regatten-import"]',
    title: "Regattenliste importieren",
    content:
      "Lädt verfügbare Regatten aus der Manage2Sail-Klassenübersicht der 420er-KV. " +
      "Stammdaten und Ranglistenfaktor werden dabei vorausgefüllt.",
    placement: "bottom-end",
  },
  {
    id: "regatten-filter",
    target: '[data-tour="regatten-filter"]',
    title: "Filter nach Jahr & Name",
    content:
      "Filtere die Regattenliste nach Saison-Jahr oder suche direkt nach dem Regattenamen. " +
      "Der gewählte Jahrgang wird als Cookie gespeichert, damit er beim nächsten " +
      "Besuch noch aktiv ist.",
    placement: "bottom",
  },
  {
    id: "regatten-tabelle",
    target: '[data-tour="regatten-tabelle"]',
    title: "Regattenliste",
    content:
      "Klicke auf eine Regatta, um Details einzusehen und Ergebnisse zu importieren. " +
      "Das grüne 'RL'-Badge markiert Ranglistenregatten. " +
      "Über den Import-Wizard in der Detailseite lädst du die Ergebnisse aus " +
      "Manage2Sail (Web-Copy-Paste oder PDF).",
    placement: "bottom",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ year?: string; q?: string }>;
};

export default async function RegattenPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  // Collect all years that have regattas for the filter dropdown
  const allDates = await db.regatta.findMany({
    select: { startDate: true },
    orderBy: { startDate: "asc" },
  });
  const years = [...new Set(allDates.map((r) => r.startDate.getFullYear()))].sort();

  const currentYear = new Date().getFullYear();

  // Priority: URL param → cookie → most recent year with data (not necessarily current year)
  const cookieStore = await cookies();
  const yearParam = sp.year ?? cookieStore.get("admin-year")?.value;
  const showAll = yearParam === "all";
  const defaultYear = years.includes(currentYear)
    ? currentYear
    : (years[years.length - 1] ?? currentYear);
  const selectedYear = !yearParam || showAll ? defaultYear : parseInt(yearParam, 10);

  // Build Prisma where: combine year filter + name search
  const yearWhere = showAll
    ? undefined
    : {
        startDate: {
          gte: new Date(selectedYear, 0, 1),
          lte: new Date(selectedYear, 11, 31, 23, 59, 59),
        },
      };

  const allRegattas = await db.regatta.findMany({
    where: yearWhere,
    orderBy: { startDate: "asc" },
    include: { _count: { select: { teamEntries: true } } },
  });

  // JS-Filter: case-insensitive (Prisma `contains` ist auf PostgreSQL case-
  // sensitive und auf SQLite nur für ASCII case-insensitiv).
  const regattas = q
    ? (() => {
        const nq = q.toLowerCase();
        return allRegattas.filter((r) => r.name.toLowerCase().includes(nq));
      })()
    : allRegattas;

  // Serialize for client component (Dates → strings, Decimal → number)
  const serialized = regattas.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    numDays: r.numDays,
    completedRaces: r.completedRaces,
    ranglistenFaktor: Number(r.ranglistenFaktor),
    isRanglistenRegatta: r.isRanglistenRegatta,
    sourceUrl: r.sourceUrl,
    entryCount: r._count.teamEntries,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Regatten ({regattas.length}{q && " gefunden"})
        </h1>
        <div className="flex items-center gap-2">
          <PageTour steps={REGATTEN_TOUR} />
          <Link
            href="/admin/regatten/import"
            data-tour="regatten-import"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Liste importieren
          </Link>
          <Link
            href="/admin/regatten/neu"
            data-tour="regatten-neu"
            className={cn(buttonVariants({ size: "sm" }))}>
            + Neue Regatta
          </Link>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-3" data-tour="regatten-filter">
        <SearchInput placeholder="Name suchen…" paramName="q" initialValue={q} />

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Jahr:</label>
          <YearSelect
            years={years}
            selected={showAll ? "all" : String(selectedYear)}
            basePath="/admin/regatten"
          />
          {((!showAll && selectedYear !== defaultYear) || q) && (
            <Link
              href="/admin/regatten"
              className="text-xs text-muted-foreground hover:underline"
            >
              Zurücksetzen
            </Link>
          )}
        </div>
      </div>

      {/* Table with M2S sync */}
      <div data-tour="regatten-tabelle">
        <RegattaTableWithSync
          regattas={serialized}
          year={showAll ? "all" : selectedYear}
          q={q}
        />
      </div>
    </div>
  );
}
