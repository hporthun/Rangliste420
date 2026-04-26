import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/search-input";
import { YearSelect } from "@/components/year-select";
import { RegattaTableWithSync } from "@/components/admin/regatta-table-sync";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ year?: string; q?: string }>;
};

export default async function RegattenPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  // Collect all years that have regattas for the filter dropdown
  const allRegattas = await db.regatta.findMany({
    select: { startDate: true },
    orderBy: { startDate: "asc" },
  });
  const years = [...new Set(allRegattas.map((r) => r.startDate.getFullYear()))].sort();

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

  const searchWhere = q ? { name: { contains: q } } : undefined;

  const regattas = await db.regatta.findMany({
    where:
      yearWhere && searchWhere
        ? { AND: [yearWhere, searchWhere] }
        : yearWhere ?? searchWhere,
    orderBy: { startDate: "asc" },
    include: { _count: { select: { teamEntries: true } } },
  });

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
        <div className="flex gap-2">
          <Link
            href="/admin/regatten/import"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Liste importieren
          </Link>
          <Link href="/admin/regatten/neu" className={cn(buttonVariants({ size: "sm" }))}>
            + Neue Regatta
          </Link>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-3">
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
      <RegattaTableWithSync
        regattas={serialized}
        year={showAll ? "all" : selectedYear}
        q={q}
      />
    </div>
  );
}
