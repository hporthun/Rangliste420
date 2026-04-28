import { computeRankingAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
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
      "Wähle Typ, Zeitraum, Altersklasse und Gender-Kategorie. " +
      "Die Jahresrangliste läuft typischerweise vom 01.01. bis 30.11. des Saison-Jahres. " +
      "Die Aktuelle Rangliste verwendet immer das heutige Datum als Stichtag. " +
      "Klicke 'Rangliste berechnen', um die Vorschau zu laden.",
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
      "Nur Jahresranglisten können gespeichert und anschließend veröffentlicht werden. " +
      "Aktuelle Rangliste und IDJM-Quali werden immer on-demand berechnet und nicht gespeichert.",
    placement: "bottom-end",
  },
];

const AGE_CATEGORIES = ["OPEN", "U19", "U17", "U16", "U15"] as const;
const GENDER_CATEGORIES = ["OPEN", "MEN", "MIX", "GIRLS"] as const;
const RANKING_TYPES: RankingType[] = ["JAHRESRANGLISTE", "AKTUELLE", "IDJM"];

type Props = {
  searchParams: Promise<{
    type?: string;
    from?: string;
    ref?: string;
    age?: string;
    gender?: string;
  }>;
};

export default async function VorschauPage({ searchParams }: Props) {
  const sp = await searchParams;
  const type = (sp.type as RankingType) ?? "JAHRESRANGLISTE";
  const currentYear = new Date().getFullYear();
  const age = (sp.age ?? "OPEN") as ComputeParams["ageCategory"];
  const gender = (sp.gender ?? "OPEN") as ComputeParams["genderCategory"];

  // Default end date: Nov 30 for Jahresrangliste, today for others
  const defaultRef =
    type === "JAHRESRANGLISTE"
      ? `${currentYear}-11-30`
      : new Date().toISOString().slice(0, 10);
  const ref = sp.ref ?? defaultRef;

  // Default start date: Jan 1 of the end-date's year
  const endYear = new Date(ref).getFullYear();
  const defaultFrom = `${endYear}-01-01`;
  const from = sp.from ?? defaultFrom;

  const hasParams = !!sp.type || !!sp.from || !!sp.ref;
  const params: ComputeParams = {
    type,
    seasonStart: from,
    referenceDate: ref,
    ageCategory: age,
    genderCategory: gender,
  };

  const result = hasParams ? await computeRankingAction(params) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Rangliste berechnen</h1>
          <p className="text-sm text-muted-foreground">
            Wähle den Zeitraum und die Parameter. Jahresranglisten können gespeichert und
            veröffentlicht werden.
          </p>
        </div>
        <PageTour steps={VORSCHAU_TOUR} />
      </div>

      {/* Parameter form — GET-based for server-side rendering */}
      <form method="GET" className="rounded-md border p-4 space-y-4 bg-gray-50" data-tour="vorschau-form">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Typ</label>
            <select name="type" defaultValue={type} className="input text-sm">
              {RANKING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "JAHRESRANGLISTE"
                    ? "Jahresrangliste"
                    : t === "AKTUELLE"
                    ? "Aktuelle Rangliste"
                    : "IDJM-Quali"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Von</label>
            <input name="from" type="date" defaultValue={from} className="input text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Bis (Stichtag)</label>
            <input name="ref" type="date" defaultValue={ref} className="input text-sm" />
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
        </div>

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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {result.data.rows.length} Segler gelistet · {result.data.regattas.length} Regatten
            </p>
            {type === "JAHRESRANGLISTE" && (
              <Link
                href={`/admin/ranglisten/neu?${new URLSearchParams(sp as Record<string, string>)}`}
                data-tour="vorschau-speichern"
                className="text-xs text-blue-600 hover:underline"
              >
                Als Jahresrangliste speichern →
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
