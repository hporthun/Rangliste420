import { computeRankingAction, getRankingForEditAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import { CrewLabel } from "@/components/rankings/crew-label";
import Link from "next/link";
import { SaveRanklisteForm } from "./save-form";

type Props = {
  searchParams: Promise<{
    type?: string;
    season?: string;
    from?: string;
    ref?: string;
    age?: string;
    gender?: string;
    unit?: string;
    /** Issue #26: when set, save flow updates this ranking instead of creating a new one. */
    editId?: string;
  }>;
};

export default async function NeueRanglistePage({ searchParams }: Props) {
  const sp = await searchParams;

  // Edit mode: hydrate name + params from the saved ranking unless the URL
  // explicitly overrides them.
  const editing = sp.editId
    ? (await getRankingForEditAction(sp.editId))
    : null;
  const editingData = editing && editing.ok ? editing.data : null;

  const type = ((sp.type ?? editingData?.params.type ?? "JAHRESRANGLISTE") as RankingType);
  const age = (sp.age ?? editingData?.params.ageCategory ?? "OPEN") as ComputeParams["ageCategory"];
  const gender = (sp.gender ?? editingData?.params.genderCategory ?? "OPEN") as ComputeParams["genderCategory"];
  const unit = ((sp.unit ?? editingData?.params.scoringUnit ?? "HELM") === "CREW" ? "CREW" : "HELM") as "HELM" | "CREW";

  const currentYear = new Date().getFullYear();
  const defaultRef = type === "AKTUELLE"
    ? new Date().toISOString().slice(0, 10)
    : `${currentYear}-11-30`;
  const ref = sp.ref ?? editingData?.params.referenceDate ?? defaultRef;
  const endYear = new Date(ref).getFullYear();
  const from = sp.from ?? editingData?.params.seasonStart ?? `${endYear}-01-01`;

  const params: ComputeParams = {
    type,
    seasonStart: from,
    referenceDate: ref,
    ageCategory: age,
    genderCategory: gender,
    scoringUnit: unit,
  };

  const result = await computeRankingAction(params);

  const typeLabel: Record<RankingType, string> = {
    JAHRESRANGLISTE: "Jahresrangliste",
    AKTUELLE:        "Aktuelle Rangliste",
    IDJM:            "IDJM-Quali",
  };

  const fromLabel = new Date(from).toLocaleDateString("de-DE");
  const toLabel   = new Date(ref).toLocaleDateString("de-DE");
  const defaultName = editingData?.name
    ?? `${typeLabel[type]} ${endYear} ${age}/${gender}`;
  const backUrl = `/admin/ranglisten/vorschau?${new URLSearchParams(sp as Record<string, string>)}`;

  const headingPrefix = editingData ? "Rangliste aktualisieren" : `${typeLabel[type]} speichern`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backUrl} className="text-sm text-blue-600 hover:underline">
          ← Zurück zur Vorschau
        </Link>
        <h1 className="text-xl font-semibold mt-2">{headingPrefix}</h1>
        <p className="text-sm text-muted-foreground">
          {typeLabel[type]} · {age} / {gender} · {fromLabel} – {toLabel}
        </p>
      </div>

      {!result.ok && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {result.error}
        </p>
      )}

      {result.ok && (
        <>
          <SaveRanklisteForm
            defaultName={defaultName}
            params={params}
            regattaIds={result.data.regattas.map((r) => r.id)}
            editId={editingData?.id ?? null}
          />

          {/* Preview table */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {result.data.rows.length} Segler · {result.data.regattas.length} Regatten
            </p>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left w-12">Platz</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Verein</th>
                    <th className="px-4 py-2 text-right">R</th>
                    <th className="px-4 py-2 text-right">Wertungen</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.data.rows.map((row) => (
                    <tr key={row.sailorId}>
                      <td className="px-4 py-2 font-medium text-center">{row.rank}</td>
                      <td className="px-4 py-2">
                        {row.firstName} {row.lastName}
                        <CrewLabel crews={row.partners} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{row.club ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium">
                        {row.R.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                        {row.valuesCount}
                      </td>
                    </tr>
                  ))}
                  {result.data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                        Keine Segler mit ≥ 9 Wertungen gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
