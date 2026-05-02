import { db } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { computeRankingAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import { computeJwmJemAction, type JwmJemParams, type JwmJemDisplayRow } from "@/lib/actions/jwm-jem";
import { CrewLabel } from "@/components/rankings/crew-label";
import { MissingBirthYearBadge } from "@/components/rankings/missing-birth-year-badge";
import { RankingFilterBar } from "@/components/rankings/ranking-filter-bar";
import Link from "next/link";

const VALID_AGE_PARAMS = ["U22", "U19", "U17", "U16", "U15"] as const;
const VALID_GENDER_PARAMS = ["OPEN", "MEN", "MIX", "GIRLS"] as const;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ age?: string; gender?: string }>;
};

export default async function RanglistePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { age: ageParam, gender: genderParam } = await searchParams;

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
      scoringUnit: true,
      rankingRegattas: {
        select: { regattaId: true },
      },
    },
  });

  if (!ranking) notFound();

  const isIdjm = ranking.type === "IDJM_QUALI";

  // Parse + validate filter URL params
  const rawAge = VALID_AGE_PARAMS.includes(ageParam as (typeof VALID_AGE_PARAMS)[number])
    ? (ageParam as string)
    : "";
  // IDJM doesn't support U22
  const filterAge = isIdjm && rawAge === "U22" ? "" : rawAge;
  const filterGender = VALID_GENDER_PARAMS.includes(genderParam as (typeof VALID_GENDER_PARAMS)[number])
    ? (genderParam as string)
    : "";

  // ── JWM/JEM Quali branch ───────────────────────────────────────────────────
  if (ranking.type === "JWM_QUALI" || ranking.type === "JEM_QUALI") {
    const effectiveAge = (filterAge || ranking.ageCategory) as JwmJemParams["ageCategory"];
    const effectiveGender = (filterGender || ranking.genderCategory) as JwmJemParams["genderCategory"];

    const jwmParams: JwmJemParams = {
      regattaIds: ranking.rankingRegattas.map((rr) => rr.regattaId),
      ageCategory: effectiveAge,
      genderCategory: effectiveGender,
      referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    };

    const result = await computeJwmJemAction(jwmParams);

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

    const { ranked, preliminary, excludedSwap, regattas } = result.data;
    const typeLabel = ranking.type === "JWM_QUALI" ? "JWM-Qualifikation" : "JEM-Qualifikation";

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
        <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 px-5 py-4 shadow-sm">
          <h1 className="text-xl font-bold">{ranking.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span>{typeLabel}</span>
            <span>{effectiveAge} / {effectiveGender}</span>
            <span>Saison {ranking.seasonStart.getFullYear()}</span>
            <span>Stichtag {ranking.seasonEnd.toLocaleDateString("de-DE")}</span>
          </div>
          <div className="mt-3">
            <Link
              href={`/rangliste/${id}/regatten`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border rounded px-2.5 py-1 hover:bg-muted/60 transition-colors"
            >
              Verwendete Regatten →
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <RankingFilterBar currentAge={filterAge} currentGender={filterGender} />

        {/* Main ranking */}
        {ranked.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-base">Qualifikationsrangliste</h2>
            <JwmJemTable rows={ranked} regattas={regattas} />
          </div>
        )}

        {/* Preliminary */}
        {preliminary.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-base text-muted-foreground">
              Vorläufig / Zwischenergebnis
            </h2>
            <p className="text-xs text-muted-foreground">
              Diese Segler haben bisher nur an einer Regatta teilgenommen.
            </p>
            <JwmJemTable rows={preliminary} regattas={regattas} />
          </div>
        )}

        {/* Excluded due to unapproved crew swap */}
        {excludedSwap.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-base text-muted-foreground">
              Nicht gewertet — ungenehmigter Schottenwechsel
            </h2>
            <p className="text-xs text-muted-foreground">
              Diese Teams sind nur durch einen ungenehmigten Schottenwechsel
              entstanden und haben kein gewertetes Ergebnis.
            </p>
            <JwmJemExcludedSwapTable rows={excludedSwap} regattas={regattas} />
          </div>
        )}

        {ranked.length === 0 && preliminary.length === 0 && excludedSwap.length === 0 && (
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <p className="px-4 py-10 text-center text-muted-foreground text-sm">
              Noch keine qualifizierten Segler.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Quali-Score = Summe der 2 besten gewichteten Platzierungen.
          Gewichteter Platz = Rang × (max. Starter / Starter dieser Regatta).
          Nur deutsche Steuerleute (Nationalität GER).
        </p>
      </div>
    );
  }

  // ── DSV / IDJM branch (existing) ──────────────────────────────────────────
  const scoringUnit = (ranking.scoringUnit ?? "HELM") as "HELM" | "CREW";
  const effectiveAge = (filterAge || ranking.ageCategory) as ComputeParams["ageCategory"];
  const effectiveGender = (filterGender || ranking.genderCategory) as ComputeParams["genderCategory"];

  const computeParams: ComputeParams = {
    type: ranking.type as RankingType,
    seasonStart: ranking.seasonStart.toISOString().slice(0, 10),
    referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    ageCategory: effectiveAge,
    genderCategory: effectiveGender,
    scoringUnit,
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
      <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 px-5 py-4 shadow-sm">
        <h1 className="text-xl font-bold">{ranking.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          <span>{effectiveAge} / {effectiveGender}</span>
          <span>Saison {ranking.seasonStart.getFullYear()}</span>
          <span>Stichtag {ranking.seasonEnd.toLocaleDateString("de-DE")}</span>
        </div>
        <div className="mt-3">
          <Link
            href={`/rangliste/${id}/regatten`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border rounded px-2.5 py-1 hover:bg-muted/60 transition-colors"
          >
            Verwendete Regatten →
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <RankingFilterBar currentAge={filterAge} currentGender={filterGender} hideU22={isIdjm} />

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[320px]">
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
              <tr
                key={row.sailorId}
                className={`hover:bg-muted/40 transition-colors group ${
                  idx === 0
                    ? "bg-yellow-50/60"
                    : idx === 1
                    ? "bg-slate-50/60"
                    : idx === 2
                    ? "bg-orange-50/40"
                    : ""
                }`}
              >
                <td className="px-4 py-3 text-center">
                  {idx === 0 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm ring-1 ring-yellow-200">
                      1
                    </span>
                  ) : idx === 1 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-sm ring-1 ring-slate-200">
                      2
                    </span>
                  ) : idx === 2 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm ring-1 ring-orange-200">
                      3
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium tabular-nums">{row.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/rangliste/${id}/steuermann/${row.sailorId}`}
                    className="hover:text-accent transition-colors"
                  >
                    {row.firstName} {row.lastName}
                  </Link>
                  {row.birthYearMissing && <MissingBirthYearBadge />}
                  <CrewLabel crews={row.partners} prefix={scoringUnit === "CREW" ? "Steuermann" : "Crew"} />
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
                    href={`/rangliste/${id}/steuermann/${row.sailorId}`}
                    className="text-xs text-accent/50 group-hover:text-accent transition-colors"
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

// ── JWM/JEM specific table ────────────────────────────────────────────────────

type RegattaMeta = {
  id: string;
  name: string;
  startDate: string;
  starters: number;
};

function JwmJemTable({
  rows,
  regattas,
}: {
  rows: JwmJemDisplayRow[];
  regattas: RegattaMeta[];
}) {
  return (
    <div className="rounded-lg border overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
            <th className="px-4 py-2.5 text-center w-12">Platz</th>
            <th className="px-4 py-2.5 text-left">Name</th>
            <th className="px-4 py-2.5 text-left hidden sm:table-cell">Verein</th>
            <th className="px-4 py-2.5 text-right">Quali-Score</th>
            {regattas.map((r) => (
              <th key={r.id} className="px-3 py-2.5 text-right min-w-24">
                <span
                  className="block truncate max-w-28"
                  title={r.name}
                >
                  {r.name.length > 16 ? r.name.slice(0, 14) + "…" : r.name}
                </span>
                <span className="font-normal normal-case text-xs block">
                  {new Date(r.startDate).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <span className="font-normal normal-case text-xs block text-muted-foreground/70">
                  {r.starters} TN
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {rows.map((row, idx) => (
            <tr
              key={row.teamKey}
              className={`hover:bg-muted/40 transition-colors group ${
                idx === 0 && row.rank !== null
                  ? "bg-yellow-50/60"
                  : idx === 1 && row.rank !== null
                  ? "bg-slate-50/60"
                  : idx === 2 && row.rank !== null
                  ? "bg-orange-50/40"
                  : ""
              }`}
            >
              <td className="px-4 py-3 text-center">
                {row.rank === 1 ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm ring-1 ring-yellow-200">
                    1
                  </span>
                ) : row.rank === 2 ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-sm ring-1 ring-slate-200">
                    2
                  </span>
                ) : row.rank === 3 ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm ring-1 ring-orange-200">
                    3
                  </span>
                ) : (
                  <span className="text-muted-foreground font-medium tabular-nums">
                    {row.rank ?? "—"}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium">
                {row.firstName} {row.lastName}
                {row.splitFromSwap && (
                  <span
                    className="ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle"
                    title="Eigenständige Wertung wegen ungenehmigtem Schottenwechsel"
                  >
                    neues Team
                  </span>
                )}
                {row.birthYearMissing && <MissingBirthYearBadge />}
                <CrewLabel crews={row.crews} />
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                {row.club ?? "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                {row.qualiScore.toFixed(2)}
              </td>
              {regattas.map((reg) => {
                const slot = row.slots.find((s) => s.regattaId === reg.id);
                if (!slot || slot.finalRank === null) {
                  return (
                    <td
                      key={reg.id}
                      className="px-3 py-3 text-right text-muted-foreground text-xs"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={reg.id}
                    className={`px-3 py-3 text-right tabular-nums ${
                      slot.counted ? "font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    <span className="block">{slot.finalRank}.</span>
                    {slot.weightedScore !== null && (
                      <span className="block text-xs text-muted-foreground font-normal">
                        {slot.weightedScore.toFixed(2)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabelle für nicht gewertete Teams (ungenehmigter Schottenwechsel) ─────────

function JwmJemExcludedSwapTable({
  rows,
  regattas,
}: {
  rows: JwmJemDisplayRow[];
  regattas: RegattaMeta[];
}) {
  const regattaById = new Map(regattas.map((r) => [r.id, r]));
  return (
    <div className="rounded-lg border overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
            <th className="px-4 py-2.5 text-left">Name</th>
            <th className="px-4 py-2.5 text-left hidden sm:table-cell">Verein</th>
            <th className="px-4 py-2.5 text-left">Wechsel-Regatta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {rows.map((row) => {
            const swapReg = row.excludedSwapRegattaId
              ? regattaById.get(row.excludedSwapRegattaId)
              : null;
            return (
              <tr key={row.teamKey} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {row.firstName} {row.lastName}
                  <span
                    className="ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle"
                    title="Eigenständige Wertung wegen ungenehmigtem Schottenwechsel"
                  >
                    neues Team
                  </span>
                  {row.birthYearMissing && <MissingBirthYearBadge />}
                  <CrewLabel crews={row.crews} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                  {row.club ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {swapReg
                    ? `${swapReg.name} (${new Date(swapReg.startDate).toLocaleDateString("de-DE")})`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
