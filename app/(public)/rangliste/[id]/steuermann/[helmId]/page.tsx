import { db } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { computeHelmDetailAction, type ComputeParams, type RankingType } from "@/lib/actions/rankings";
import Link from "next/link";

type Props = { params: Promise<{ id: string; helmId: string }> };

export default async function PublicSteuermanDetailPage({ params }: Props) {
  const { id, helmId } = await params;

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
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      scoringUnit: true,
      isPublic: true,
    },
  });

  if (!ranking) notFound();
  if (!ranking.isPublic && !isSignedIn) notFound();

  const computeParams: ComputeParams = {
    type: ranking.type as RankingType,
    seasonStart: ranking.seasonStart.toISOString().slice(0, 10),
    referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    ageCategory: ranking.ageCategory as ComputeParams["ageCategory"],
    genderCategory: ranking.genderCategory as ComputeParams["genderCategory"],
    scoringUnit: (ranking.scoringUnit === "CREW" ? "CREW" : "HELM"),
  };

  const result = await computeHelmDetailAction(computeParams, helmId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Link
          href={`/rangliste/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {ranking.name}
        </Link>
        <p className="text-sm text-red-600">{result.error}</p>
      </div>
    );
  }

  const { data: d } = result;
  const partnerLabel = computeParams.scoringUnit === "CREW" ? "Steuermann" : "Crew";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/rangliste/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← {ranking.name}
      </Link>

      {/* Header — fuer in-Wertung: "Platz X", sonst: "Noch nicht in der Wertung"-Badge */}
      <div className="space-y-1">
        {d.inWertung ? (
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Platz {d.rank}
          </p>
        ) : (
          <p className="inline-flex items-center text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
            Noch nicht in der Wertung
          </p>
        )}
        <h1 className="text-2xl font-semibold">
          {d.firstName} {d.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {d.club ?? "kein Verein"}
        </p>
      </div>

      {/* Summary card — entweder R (in-Wertung) oder Wertungsfortschritt */}
      <div className="sea-card px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {d.inWertung ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Ranglistenpunktzahl R
              </p>
              <p className="text-3xl font-bold font-mono mt-1">{d.R!.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mittel der 9 besten R_A-Werte
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground">
              <p>{d.top9.length} einfließende Wertungen</p>
              {d.nonContributing.length > 0 && (
                <p>{d.nonContributing.length} weitere (nicht einfließend)</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Wertungs-Fortschritt
              </p>
              <p className="text-3xl font-bold font-mono mt-1">
                {d.valuesCount} <span className="text-muted-foreground/70 text-xl">/ 9</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mindestanzahl der DSV-Rangliste — noch{" "}
                <strong>{Math.max(0, 9 - d.valuesCount)}</strong>{" "}
                {9 - d.valuesCount === 1 ? "Wertung" : "Wertungen"} fehlen.
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground">
              <p>R wird erst ab 9 Wertungen berechnet.</p>
            </div>
          </>
        )}
      </div>

      {/* Werte-Tabelle: in-Wertung -> "Einfliessende 9 Wertungen", sonst -> "Bisherige Wertungen" */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">
          {d.inWertung
            ? `Einfließende ${d.top9.length} Wertungen`
            : `Bisherige Wertungen (${d.top9.length})`}
        </h2>
        <div className="rounded-lg border overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2.5 text-left">Regatta</th>
                <th className="px-3 py-2.5 text-left">Datum</th>
                <th className="px-3 py-2.5 text-right">f</th>
                <th className="px-3 py-2.5 text-right">s</th>
                <th className="px-3 py-2.5 text-right">x</th>
                <th className="px-3 py-2.5 text-right">R_A</th>
                <th className="px-3 py-2.5 text-right">m</th>
                <th className="px-3 py-2.5 text-right">Eintrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {d.top9.map((v, i) => (
                <tr key={i} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/regatta/${v.regattaId}`}
                      className="text-accent hover:underline"
                    >
                      {v.regattaName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {new Date(v.regattaDate).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{v.f.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{v.s}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {v.inStartArea && v.x == null ? (
                      <span className="text-amber-600 font-semibold">SG</span>
                    ) : (
                      v.x ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {v.rA.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{v.m}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground font-mono tabular-nums text-xs">
                    {v.multiplierIndex + 1}/{v.m}
                  </td>
                </tr>
              ))}
            </tbody>
            {d.inWertung && (
              <tfoot>
                <tr className="table-head-maritime">
                  <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-right">
                    R =
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-base">
                    {d.R!.toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          R_A = f × 100 × ((s + 1 − x) / s)
          {d.inWertung && " · R = Mittel der 9 besten R_A-Werte"}
        </p>
      </div>

      {/* Non-contributing values */}
      {d.nonContributing.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
            <span className="text-xs border rounded px-1.5 py-0.5 group-open:rotate-90 transition-transform inline-block">
              ▶
            </span>
            Nicht einfließende Wertungen ({d.nonContributing.length})
          </summary>
          <div className="rounded-lg border overflow-x-auto mt-3 shadow-sm">
            <table className="w-full text-xs min-w-[460px]">
              <thead>
                <tr className="table-head-maritime text-muted-foreground uppercase">
                  <th className="px-3 py-2 text-left">Regatta</th>
                  <th className="px-3 py-2 text-right">f</th>
                  <th className="px-3 py-2 text-right">s</th>
                  <th className="px-3 py-2 text-right">x</th>
                  <th className="px-3 py-2 text-right">R_A</th>
                  <th className="px-3 py-2 text-right">Eintrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card text-muted-foreground">
                {d.nonContributing.map((v, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">{v.regattaName}</td>
                    <td className="px-3 py-2 text-right font-mono">{v.f.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{v.s}</td>
                    <td className="px-3 py-2 text-right font-mono">{v.x ?? "SG"}</td>
                    <td className="px-3 py-2 text-right font-mono">{v.rA.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {v.multiplierIndex + 1}/{v.m}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Partner history */}
      {d.partnerHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">{partnerLabel}-Historie</h2>
          <div className="rounded-lg border overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="table-head-maritime text-xs text-muted-foreground uppercase">
                  <th className="px-3 py-2.5 text-left">Regatta</th>
                  <th className="px-3 py-2.5 text-left">Datum</th>
                  <th className="px-3 py-2.5 text-left">{partnerLabel}</th>
                  <th className="px-3 py-2.5 text-left">Segel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {d.partnerHistory.map((c, i) => (
                  <tr key={i} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5">{c.regattaName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs tabular-nums">
                      {new Date(c.regattaDate).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.partnerFirstName && c.partnerLastName ? (
                        `${c.partnerFirstName} ${c.partnerLastName}`
                      ) : (
                        <span className="text-muted-foreground italic text-xs">{`kein${partnerLabel === "Crew" ? "e" : ""} ${partnerLabel}`}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {c.sailNumber ?? "—"}
                    </td>
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
