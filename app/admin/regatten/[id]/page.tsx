import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { RegattaForm } from "@/components/regatta-form";
import { updateRegatta } from "@/lib/actions/regattas";
import { DeleteRegattaButton } from "@/components/delete-regatta-button";
import { PageTour } from "@/components/tour/page-tour";
import { CrewSwapToggle } from "@/components/admin/crew-swap-toggle";
import { EditTeamEntry } from "@/components/admin/edit-team-entry";
import { DeleteTeamEntryButton } from "@/components/admin/delete-team-entry-button";
import { AddTeamEntry } from "@/components/admin/add-team-entry";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/components/tour/tour-context";

const REGATTA_DETAIL_TOUR: TourStep[] = [
  {
    id: "regatta-form",
    target: '[data-tour="regatta-form"]',
    title: "Regatta-Metadaten",
    content:
      "Hier pflegst du alle fachlich relevanten Felder: " +
      "Ranglistenfaktor f (beeinflusst direkt alle R_A-Werte), " +
      "Anzahl der Wettfahrten (bestimmt den Multiplikator m), " +
      "und ob die Regatta als Ranglistenregatta gilt.",
    placement: "bottom",
  },
  {
    id: "regatta-import",
    target: '[data-tour="regatta-import"]',
    title: "Ergebnisse importieren",
    content:
      "Startet den Import-Wizard für diese Regatta. " +
      "Unterstützt Web-Copy-Paste aus Manage2Sail (empfohlen, enthält Crew) " +
      "und PDF-Upload als Fallback (nur Steuermann, Crew wird nachgepflegt).",
    placement: "bottom-end",
  },
  {
    id: "regatta-ergebnisse",
    target: '[data-tour="regatta-ergebnisse"]',
    title: "Ergebnisliste",
    content:
      "Zeigt alle importierten Einträge mit Platzierung, Segelnummer, " +
      "Steuermann/Crew und Einzel-Wettfahrtergebnissen. " +
      "Die SG-Spalte (Startgebiet) markiert Boote, die ins Startgebiet kamen — " +
      "diese erhalten R_A = 0, zählen aber in s.",
    placement: "bottom",
  },
];

type RacePoint = {
  race: number;
  points: number;
  code?: string;
  isDiscard?: boolean;
};

type Props = { params: Promise<{ id: string }> };

export default async function EditRegattaPage({ params }: Props) {
  const { id } = await params;

  const [regatta, entries, allSailors] = await Promise.all([
    db.regatta.findUnique({ where: { id } }),
    db.teamEntry.findMany({
      where: { regattaId: id },
      include: {
        helm: { select: { id: true, firstName: true, lastName: true } },
        crew: { select: { id: true, firstName: true, lastName: true } },
        result: {
          select: {
            finalRank: true,
            finalPoints: true,
            racePoints: true,
            inStartArea: true,
          },
        },
      },
      // crewSwapApproved + crewSwapNote sind via Default-Select bereits drin
      orderBy: [
        // nulls last: entries without a result rank go to the bottom
        { result: { finalRank: "asc" } },
      ],
    }),
    db.sailor.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  if (!regatta) notFound();

  async function updateAction(data: FormData) {
    "use server";
    return updateRegatta(id, data);
  }

  // Parse race points for display
  const entriesWithParsed = entries.map((e) => ({
    ...e,
    racePoints: e.result ? (JSON.parse(e.result.racePoints) as RacePoint[]) : [],
  }));

  // How many races to show as individual columns (max 15, rest collapsed)
  const numRaces = regatta.completedRaces;
  const showIndividualRaces = numRaces > 0 && numRaces <= 15;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/regatten" className="hover:underline">Regatten</Link>
        <span>›</span>
        <span>{regatta.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">Regatta bearbeiten</h1>
        <div className="flex items-center gap-2">
          <PageTour steps={REGATTA_DETAIL_TOUR} />
          <DeleteRegattaButton id={id} entryCount={entries.length} />
        </div>
      </div>

      <div data-tour="regatta-form">
        <RegattaForm regatta={regatta} action={updateAction} />
      </div>

      {/* Results */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Ergebnisse
            {entries.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({entries.length} Einträge)
              </span>
            )}
          </h2>
          <AddTeamEntry
            regattaId={id}
            numRaces={numRaces}
            sailors={allSailors}
          />
          <Link
            href={`/admin/import?regattaId=${id}`}
            data-tour="regatta-import"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            + Ergebnisse importieren
          </Link>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-md px-4 py-6 text-center">
            Noch keine Ergebnisse importiert.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto" data-tour="regatta-ergebnisse">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-right w-12">Pl.</th>
                  <th className="px-3 py-2 text-left w-24">Segel</th>
                  <th className="px-3 py-2 text-left">Steuermann</th>
                  <th className="px-3 py-2 text-left">Crew</th>
                  <th className="px-3 py-2 text-right">Netto</th>
                  {showIndividualRaces
                    ? Array.from({ length: numRaces }, (_, i) => (
                        <th key={i} className="px-2 py-2 text-right w-10">
                          {i + 1}
                        </th>
                      ))
                    : <th className="px-3 py-2 text-left">Wettfahrten</th>}
                  <th className="px-3 py-2 text-center w-10" title="Startgebiet">SG</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entriesWithParsed.map((e) => (
                  <tr key={e.id} className="align-middle">
                    <td className="px-3 py-2 text-right font-medium text-muted-foreground">
                      {e.result?.finalRank ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {e.sailNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/segler/${e.helm.id}`}
                        className="hover:underline text-blue-600"
                      >
                        {e.helm.firstName} {e.helm.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {e.crew ? (
                          <Link
                            href={`/admin/segler/${e.crew.id}`}
                            className="hover:underline"
                          >
                            {e.crew.firstName} {e.crew.lastName}
                          </Link>
                        ) : (
                          <span className="italic text-xs">—</span>
                        )}
                        <CrewSwapToggle
                          teamEntryId={e.id}
                          helmName={`${e.helm.firstName} ${e.helm.lastName}`}
                          crewName={
                            e.crew ? `${e.crew.firstName} ${e.crew.lastName}` : ""
                          }
                          initialApproved={e.crewSwapApproved}
                          initialNote={e.crewSwapNote ?? ""}
                        />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {e.result?.finalPoints != null
                        ? Number(e.result.finalPoints).toFixed(1)
                        : "—"}
                    </td>
                    {showIndividualRaces
                      ? Array.from({ length: numRaces }, (_, i) => {
                          const rp = e.racePoints.find((p) => p.race === i + 1);
                          if (!rp) return <td key={i} className="px-2 py-2 text-right text-muted-foreground text-xs">—</td>;
                          const val = rp.isDiscard
                            ? `(${rp.points})`
                            : String(rp.points % 1 === 0 ? rp.points : rp.points.toFixed(1));
                          const label = rp.code ? `${val} ${rp.code}` : val;
                          return (
                            <td
                              key={i}
                              className={`px-2 py-2 text-right text-xs font-mono whitespace-nowrap ${
                                rp.isDiscard ? "text-muted-foreground line-through" : ""
                              }`}
                            >
                              {label}
                            </td>
                          );
                        })
                      : (
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                          {e.racePoints
                            .map((rp) => {
                              const val = rp.isDiscard ? `(${rp.points})` : String(rp.points);
                              return rp.code ? `${val} ${rp.code}` : val;
                            })
                            .join(" · ")}
                        </td>
                      )}
                    <td className="px-3 py-2 text-center">
                      {e.result?.inStartArea ? (
                        <span className="text-amber-600 font-medium">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <span className="inline-flex items-center gap-0.5">
                        <EditTeamEntry
                          teamEntryId={e.id}
                          helmName={`${e.helm.firstName} ${e.helm.lastName}`}
                          initialSailNumber={e.sailNumber ?? null}
                          initialInStartArea={e.result?.inStartArea ?? false}
                          initialFinalRank={e.result?.finalRank ?? null}
                          numRaces={numRaces}
                          initialRaceScores={e.racePoints.map((rp) => ({
                            ...rp,
                            isDiscard: rp.isDiscard ?? false,
                          }))}
                        />
                        <DeleteTeamEntryButton
                          teamEntryId={e.id}
                          helmName={`${e.helm.firstName} ${e.helm.lastName}`}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
