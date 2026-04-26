import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { RegattaForm } from "@/components/regatta-form";
import { updateRegatta } from "@/lib/actions/regattas";
import { DeleteRegattaButton } from "@/components/delete-regatta-button";

type RacePoint = {
  race: number;
  points: number;
  code?: string;
  isDiscard?: boolean;
};

type Props = { params: Promise<{ id: string }> };

export default async function EditRegattaPage({ params }: Props) {
  const { id } = await params;

  const [regatta, entries] = await Promise.all([
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
      orderBy: [
        // nulls last: entries without a result rank go to the bottom
        { result: { finalRank: "asc" } },
      ],
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
        <DeleteRegattaButton id={id} entryCount={entries.length} />
      </div>

      <RegattaForm regatta={regatta} action={updateAction} />

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
          <Link
            href={`/admin/import?regattaId=${id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            + Ergebnisse importieren
          </Link>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-md px-4 py-6 text-center">
            Noch keine Ergebnisse importiert.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
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
