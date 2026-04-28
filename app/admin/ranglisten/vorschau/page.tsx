import { computeRankingAction, getRankingForEditAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import Link from "next/link";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";

// ── Page-specific tour steps ──────────────────────────────────────────────────

const VORSCHAU_TOUR: TourStep[] = [
  {
    id: "vorschau-form",
    target: '[data-tour="vorschau-form"]',
    title: "Parameter einstellen",
    content:
      "Wähle Typ, Saison, Altersklasse und Gender-Kategorie. " +
      "Die Saison-Auswahl füllt automatisch sinnvolle Von/Bis-Datumsbereiche " +
      "(01.01. bis 30.11. für die Jahresrangliste, bis heute für Aktuelle Rangliste). " +
      "Beide Datumsfelder lassen sich für Sonderfälle weiterhin manuell überschreiben.",
    placement: "bottom",
  },
  {
    id: "vorschau-tabelle",
    target: '[data-tour="vorschau-tabelle"]',
    title: "Berechnete Rangliste",
    content:
      "Zeigt alle Segler mit ≥ 9 Wertungen. R ist das arithmetische Mittel der 9 besten R_A-Werte. " +
      "Klicke auf 'Detail →' um alle Wertungen eines Steuermanns mit Formelnachvollziehung zu sehen. " +
      "Die Rangliste ist noch nicht gespeichert — sie wird bei jedem Aufruf live berechnet.",
    placement: "bottom",
  },
  {
    id: "vorschau-speichern",
    target: '[data-tour="vorschau-speichern"]',
    title: "Rangliste speichern",
    content:
      "Jahresrangliste und IDJM-Quali können gespeichert und anschließend veröffentlicht werden. " +
      "Aktuelle Rangliste wird immer live berechnet und nicht persistiert.",
    placement: "bottom-end",
  },
];

const AGE_CATEGORIES = ["OPEN", "U19", "U17", "U16", "U15"] as const;
const GENDER_CATEGORIES = ["OPEN", "MEN", "MIX", "GIRLS"] as const;
const RANKING_TYPES: RankingType[] = ["JAHRESRANGLISTE", "AKTUELLE", "IDJM"];

const TYPE_LABELS: Record<RankingType, string> = {
  JAHRESRANGLISTE: "Jahresrangliste",
  AKTUELLE:        "Aktuelle Rangliste",
  IDJM:            "IDJM-Quali",
};

/**
 * Compute sensible default Von/Bis dates for a given type and season year.
 *
 * - Jahresrangliste:    01.01. – 30.11. of the season year.
 * - Aktuelle Rangliste: 01.01. – heute (current year) or 01.01. – 31.12. (past).
 * - IDJM-Quali:         01.01. – 30.11. of the season year (matches DSV cycle).
 */
function defaultRange(type: RankingType, year: number): { from: string; ref: string } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const from = `${year}-01-01`;
  if (type === "AKTUELLE") {
    const ref = year === currentYear
      ? today.toISOString().slice(0, 10)
      : `${year}-12-31`;
    return { from, ref };
  }
  // JAHRESRANGLISTE + IDJM both use Nov 30 cutoff
  return { from, ref: `${year}-11-30` };
}

type Props = {
  searchParams: Promise<{
    type?: string;
    season?: string;
    from?: string;
    ref?: string;
    age?: string;
    gender?: string;
    /** Issue #26: when present, the form edits an existing ranking instead of creating a new one. */
    editId?: string;
  }>;
};

export default async function VorschauPage({ searchParams }: Props) {
  const sp = await searchParams;

  // ── Edit mode (Issue #26) ───────────────────────────────────────────────────
  // If editId is given without explicit overrides, hydrate the form from the
  // saved Ranking. The user can then change fields and re-save.
  let editing: { id: string; name: string; params: ComputeParams } | null = null;
  if (sp.editId) {
    const res = await getRankingForEditAction(sp.editId);
    if (res.ok) editing = res.data;
  }

  // Resolve effective parameters in this priority:
  //   1. URL search params (user changed something)
  //   2. Saved ranking (when editing)
  //   3. Sensible defaults (current year)
  const currentYear = new Date().getFullYear();
  const type = (sp.type as RankingType) ?? editing?.params.type ?? "JAHRESRANGLISTE";

  // Saison: explicit ?season=YYYY → fall back to ref's year → fall back to editing's seasonEnd → current year
  const explicitSeason = sp.season ? parseInt(sp.season, 10) : null;
  const seasonFromRef = sp.ref ? new Date(sp.ref).getFullYear() : null;
  const seasonFromEditing = editing
    ? new Date(editing.params.referenceDate).getFullYear()
    : null;
  const season =
    explicitSeason ??
    seasonFromRef ??
    seasonFromEditing ??
    currentYear;

  const defaults = defaultRange(type, season);
  const from   = sp.from ?? editing?.params.seasonStart ?? defaults.from;
  const ref    = sp.ref  ?? editing?.params.referenceDate ?? defaults.ref;
  const age    = (sp.age    ?? editing?.params.ageCategory    ?? "OPEN") as ComputeParams["ageCategory"];
  const gender = (sp.gender ?? editing?.params.genderCategory ?? "OPEN") as ComputeParams["genderCategory"];

  const hasParams = !!sp.type || !!sp.season || !!sp.from || !!sp.ref || !!editing;
  const params: ComputeParams = {
    type,
    seasonStart: from,
    referenceDate: ref,
    ageCategory: age,
    genderCategory: gender,
  };

  const result = hasParams ? await computeRankingAction(params) : null;
  const canSave = type === "JAHRESRANGLISTE" || type === "IDJM";

  // Year list for the Saison dropdown — last 6 years and next 1
  const seasonYears = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);
  if (!seasonYears.includes(season)) seasonYears.push(season);
  seasonYears.sort((a, b) => b - a);

  // For the "save / update" link we forward all current search params
  const saveQs = new URLSearchParams({
    type,
    season: String(season),
    from,
    ref,
    age,
    gender,
    ...(editing ? { editId: editing.id } : {}),
  }).toString();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {editing ? "Rangliste bearbeiten" : "Rangliste berechnen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {editing
              ? `„${editing.name}" — ändere Parameter und speichere die Aktualisierung.`
              : "Wähle Typ und Saison. Jahresrangliste und IDJM-Quali können gespeichert und veröffentlicht werden."}
          </p>
        </div>
        <PageTour steps={VORSCHAU_TOUR} />
      </div>

      {/* Parameter form — GET-based for server-side rendering */}
      <form
        method="GET"
        className="rounded-md border p-4 space-y-4 bg-gray-50"
        data-tour="vorschau-form"
      >
        {/* Preserve editId across submits */}
        {editing && (
          <input type="hidden" name="editId" value={editing.id} />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Typ</label>
            <select name="type" defaultValue={type} className="input text-sm">
              {RANKING_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Issue #27: explicit Saison-Dropdown — auto-fills von/bis defaults
              on submit when no manual override is given. */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Saison</label>
            <select name="season" defaultValue={season} className="input text-sm">
              {seasonYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Altersklasse</label>
            <select name="age" defaultValue={age} className="input text-sm">
              {AGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Gender</label>
            <select name="gender" defaultValue={gender} className="input text-sm">
              {GENDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Von <span className="font-normal normal-case opacity-70">(optional)</span>
            </label>
            <input name="from" type="date" defaultValue={from} className="input text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Bis (Stichtag) <span className="font-normal normal-case opacity-70">(optional)</span>
            </label>
            <input name="ref" type="date" defaultValue={ref} className="input text-sm" />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Saison setzt Von/Bis automatisch auf 01.01.–30.11. (bzw. Heute bei Aktueller Rangliste).
          Die Datumsfelder können diesen Bereich übersteuern, z.B. um eine
          unvollständige Saison zu bewerten.
        </p>

        <button
          type="submit"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Rangliste berechnen
        </button>
      </form>

      {/* Results */}
      {result && !result.ok && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {result.data.rows.length} Segler gelistet · {result.data.regattas.length} Regatten
            </p>
            {canSave && (
              <Link
                href={`/admin/ranglisten/neu?${saveQs}`}
                data-tour="vorschau-speichern"
                className="text-xs text-blue-600 hover:underline"
              >
                {editing
                  ? "Rangliste aktualisieren →"
                  : type === "IDJM"
                  ? "Als IDJM-Quali speichern →"
                  : "Als Jahresrangliste speichern →"}
              </Link>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto" data-tour="vorschau-tabelle">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left w-12">Platz</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Verein</th>
                  <th className="px-4 py-2 text-right">R</th>
                  <th className="px-4 py-2 text-right">Wertungen</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.data.rows.map((row) => (
                  <tr key={row.helmId}>
                    <td className="px-4 py-2 font-medium text-center">{row.rank}</td>
                    <td className="px-4 py-2">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{row.club ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">
                      {row.R.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                      {row.valuesCount}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/ranglisten/vorschau/steuermann/${row.helmId}?${new URLSearchParams({ ...sp } as Record<string, string>)}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
                {result.data.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-sm">
                      Keine Segler mit ≥ 9 Wertungen gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Included regattas */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Einbezogene Regatten ({result.data.regattas.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-4">
              {result.data.regattas.map((r) => (
                <li key={r.id}>
                  {r.name} — {new Date(r.startDate).toLocaleDateString("de-DE")} (f={r.ranglistenFaktor.toFixed(2)},{" "}
                  {r.completedRaces} WF)
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
