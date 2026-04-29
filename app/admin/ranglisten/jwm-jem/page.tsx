import { db } from "@/lib/db/client";
import Link from "next/link";
import { computeJwmJemAction, type JwmJemParams } from "@/lib/actions/jwm-jem";
import { JwmJemSaveForm } from "./save-form";
import { RegattaFilterList } from "./regatta-filter-list";
import type { AgeCategory, GenderCategory } from "@/lib/scoring/filters";

const AGE_CATEGORIES: AgeCategory[] = ["U19", "U17", "U16", "U15", "OPEN"];
const GENDER_CATEGORIES: GenderCategory[] = ["OPEN", "MEN", "MIX", "GIRLS"];

type Props = {
  searchParams: Promise<{
    type?: string;
    age?: string;
    gender?: string;
    regattas?: string | string[];
    ref?: string;
  }>;
};

export default async function JwmJemPage({ searchParams }: Props) {
  const sp = await searchParams;

  const type = (sp.type === "JEM_QUALI" ? "JEM_QUALI" : "JWM_QUALI") as
    | "JWM_QUALI"
    | "JEM_QUALI";
  const age = (AGE_CATEGORIES.includes(sp.age as AgeCategory)
    ? sp.age
    : "U19") as AgeCategory;
  const gender = (GENDER_CATEGORIES.includes(sp.gender as GenderCategory)
    ? sp.gender
    : "OPEN") as GenderCategory;

  const rawRegattas = sp.regattas;
  const regattaIds = Array.isArray(rawRegattas)
    ? rawRegattas
    : rawRegattas
    ? [rawRegattas]
    : [];

  const defaultRef = new Date().toISOString().slice(0, 10);
  const ref = sp.ref ?? defaultRef;

  const hasParams = regattaIds.length > 0;

  // Fetch all regattas for the checkbox list (newest first)
  const dbRegattas = await db.regatta.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      completedRaces: true,
      _count: { select: { results: true } },
    },
  });

  // Serialize for client component
  const allRegattas = dbRegattas.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate.toISOString(),
    completedRaces: r.completedRaces,
    resultCount: r._count.results,
  }));

  // Compute results if params are provided
  const params: JwmJemParams = {
    type,
    regattaIds,
    ageCategory: age,
    genderCategory: gender,
    referenceDate: ref,
  };

  const result = hasParams ? await computeJwmJemAction(params) : null;

  const typeLabel = type === "JWM_QUALI" ? "JWM-Quali" : "JEM-Quali";
  const defaultName = `${typeLabel} ${new Date(ref).getFullYear()} ${age}/${gender}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/ranglisten"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Ranglisten
          </Link>
          <h1 className="text-xl font-semibold mt-1">
            JWM/JEM-Qualifikationsrangliste berechnen
          </h1>
          <p className="text-sm text-muted-foreground">
            Klassenspezifische Sonderregel (420er-Klassenvereinigung). Bis zu 3
            Regatten, beste 2 gewichtet.
          </p>
        </div>
      </div>

      {/* Parameter form — GET-based */}
      <form method="GET" className="rounded-md border p-4 space-y-4 bg-gray-50">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Typ
            </label>
            <select name="type" defaultValue={type} className="input text-sm">
              <option value="JWM_QUALI">JWM-Quali</option>
              <option value="JEM_QUALI">JEM-Quali</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Altersklasse
            </label>
            <select name="age" defaultValue={age} className="input text-sm">
              {AGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Gender
            </label>
            <select name="gender" defaultValue={gender} className="input text-sm">
              {GENDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Stichtag (Alter)
            </label>
            <input
              name="ref"
              type="date"
              defaultValue={ref}
              className="input text-sm"
            />
          </div>
        </div>

        {/* Regatta checkboxes with year + name filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Regatten auswählen (max. 3)
          </p>
          {allRegattas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Regatten vorhanden.
            </p>
          ) : (
            <RegattaFilterList regattas={allRegattas} selectedIds={regattaIds} />
          )}
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Rangliste berechnen
        </button>
      </form>

      {/* Error */}
      {result && !result.ok && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {result.error}
        </p>
      )}

      {/* Results */}
      {result?.ok && (
        <div className="space-y-6">
          {/* Regatta overview */}
          <div className="text-sm text-muted-foreground">
            {result.data.regattas.length} Regatten · max.{" "}
            {result.data.maxStarters} Starter
          </div>

          {/* Main ranking table */}
          {result.data.ranked.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-base">Qualifikationsrangliste</h2>
              <RankingTable rows={result.data.ranked} regattas={result.data.regattas} />
            </div>
          )}

          {/* Preliminary */}
          {result.data.preliminary.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-base text-muted-foreground">
                Zwischenergebnis (unvollständig)
              </h2>
              <p className="text-xs text-muted-foreground">
                Diese Segler haben nur an einer Regatta teilgenommen und zählen
                noch nicht für die offizielle Quali.
              </p>
              <RankingTable
                rows={result.data.preliminary}
                regattas={result.data.regattas}
              />
            </div>
          )}

          {result.data.ranked.length === 0 && result.data.preliminary.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Keine qualifizierten Segler gefunden.
            </p>
          )}

          {/* Save section */}
          <div className="space-y-2">
            <h2 className="font-semibold text-base">Rangliste speichern</h2>
            <JwmJemSaveForm params={params} defaultName={defaultName} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared table component ────────────────────────────────────────────────────

type TableRow = {
  helmId: string;
  teamKey: string;
  rank: number | null;
  firstName: string;
  lastName: string;
  club: string | null;
  qualiScore: number;
  validCount: number;
  splitFromSwap: boolean;
  slots: {
    regattaId: string;
    finalRank: number | null;
    weightedScore: number | null;
    counted: boolean;
  }[];
  crews: {
    id: string;
    firstName: string;
    lastName: string;
    count: number;
  }[];
};

type RegattaMeta = {
  id: string;
  name: string;
  startDate: string;
  starters: number;
};

function RankingTable({
  rows,
  regattas,
}: {
  rows: TableRow[];
  regattas: RegattaMeta[];
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 text-center w-12">Platz</th>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left hidden sm:table-cell">Verein</th>
            <th className="px-4 py-2 text-right">Quali-Score</th>
            {regattas.map((r) => (
              <th key={r.id} className="px-3 py-2 text-right min-w-24">
                <span className="block truncate max-w-28" title={r.name}>
                  {r.name.length > 16 ? r.name.slice(0, 14) + "…" : r.name}
                </span>
                <span className="font-normal normal-case text-xs block">
                  {new Date(r.startDate).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.teamKey} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2 text-center font-medium text-muted-foreground">
                {row.rank ?? "—"}
              </td>
              <td className="px-4 py-2 font-medium">
                {row.firstName} {row.lastName}
                {row.splitFromSwap && (
                  <span
                    className="ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle"
                    title="Eigenständige Wertung wegen ungenehmigtem Schottenwechsel"
                  >
                    neues Team
                  </span>
                )}
                {row.crews.length > 0 && (
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    Crew: {row.crews.map((c) => `${c.firstName} ${c.lastName}`).join(" · ")}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                {row.club ?? "—"}
              </td>
              <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">
                {row.qualiScore.toFixed(2)}
              </td>
              {regattas.map((reg) => {
                const slot = row.slots.find((s) => s.regattaId === reg.id);
                if (!slot || slot.finalRank === null) {
                  return (
                    <td
                      key={reg.id}
                      className="px-3 py-2 text-right text-muted-foreground text-xs"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={reg.id}
                    className={`px-3 py-2 text-right tabular-nums ${
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
