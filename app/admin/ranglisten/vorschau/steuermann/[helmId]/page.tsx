import { computeHelmDetailAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import Link from "next/link";

type Props = {
  params: Promise<{ helmId: string }>;
  searchParams: Promise<{
    type?: string;
    from?: string;
    ref?: string;
    age?: string;
    gender?: string;
  }>;
};

export default async function SteuermanDetailPage({ params, searchParams }: Props) {
  const { helmId } = await params;
  const sp = await searchParams;

  const type = (sp.type ?? "JAHRESRANGLISTE") as RankingType;
  const age = (sp.age ?? "OPEN") as ComputeParams["ageCategory"];
  const gender = (sp.gender ?? "OPEN") as ComputeParams["genderCategory"];

  const currentYear = new Date().getFullYear();
  const defaultRef =
    type === "JAHRESRANGLISTE"
      ? `${currentYear}-11-30`
      : new Date().toISOString().slice(0, 10);
  const ref = sp.ref ?? defaultRef;
  const endYear = new Date(ref).getFullYear();
  const from = sp.from ?? `${endYear}-01-01`;

  const computeParams: ComputeParams = {
    type,
    seasonStart: from,
    referenceDate: ref,
    ageCategory: age,
    genderCategory: gender,
  };

  const result = await computeHelmDetailAction(computeParams, helmId);
  const backUrl = `/admin/ranglisten/vorschau?${new URLSearchParams(sp as Record<string, string>)}`;

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link href={backUrl} className="text-sm text-blue-600 hover:underline">
          ← Zurück zur Rangliste
        </Link>
        <p className="text-sm text-red-600">{result.error}</p>
      </div>
    );
  }

  const { data: d } = result;
  const fromLabel = new Date(from).toLocaleDateString("de-DE");
  const toLabel = new Date(ref).toLocaleDateString("de-DE");

  return (
    <div className="space-y-6">
      <Link href={backUrl} className="text-sm text-blue-600 hover:underline">
        ← Zurück zur Rangliste
      </Link>

      <div>
        <h1 className="text-xl font-semibold">
          Platz {d.rank}: {d.firstName} {d.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {d.club ?? "kein Verein"} · R = {d.R.toFixed(2)} · {type} · {fromLabel} – {toLabel}
        </p>
      </div>

      {/* Top 9 */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Einfließende 9 Wertungen</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Regatta</th>
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-right">f</th>
                <th className="px-3 py-2 text-right">s</th>
                <th className="px-3 py-2 text-right">x</th>
                <th className="px-3 py-2 text-right">R_A</th>
                <th className="px-3 py-2 text-right">m</th>
                <th className="px-3 py-2 text-right">Eintrag</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.top9.map((v, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <Link href={`/regatta/${v.regattaId}`} className="hover:underline text-blue-600">
                      {v.regattaName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(v.regattaDate).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{v.f.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{v.s}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {v.inStartArea && v.x == null ? (
                      <span className="text-amber-600">SG</span>
                    ) : (
                      v.x ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{v.rA.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{v.m}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                    {v.multiplierIndex + 1}/{v.m}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-sm font-medium text-right">
                  R =
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold">{d.R.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Non-contributing values */}
      {d.nonContributing.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Nicht einfließende Wertungen ({d.nonContributing.length})
          </summary>
          <div className="rounded-md border overflow-x-auto mt-2">
            <table className="w-full text-xs min-w-[500px] text-muted-foreground">
              <thead className="bg-gray-50 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Regatta</th>
                  <th className="px-3 py-2 text-right">f</th>
                  <th className="px-3 py-2 text-right">s</th>
                  <th className="px-3 py-2 text-right">x</th>
                  <th className="px-3 py-2 text-right">R_A</th>
                  <th className="px-3 py-2 text-right">Eintrag</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.nonContributing.map((v, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{v.regattaName}</td>
                    <td className="px-3 py-2 text-right">{v.f.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{v.s}</td>
                    <td className="px-3 py-2 text-right">{v.x ?? "SG"}</td>
                    <td className="px-3 py-2 text-right">{v.rA.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{v.multiplierIndex + 1}/{v.m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Crew history */}
      {d.crewHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-medium">Crew-Historie</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Regatta</th>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Crew</th>
                  <th className="px-3 py-2 text-left">Segel</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.crewHistory.map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{c.regattaName}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {new Date(c.regattaDate).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-3 py-2">
                      {c.crewFirstName && c.crewLastName
                        ? `${c.crewFirstName} ${c.crewLastName}`
                        : <span className="text-muted-foreground italic">keine Crew</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{c.sailNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
