import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { SailorForm } from "@/components/sailor-form";
import { updateSailor } from "@/lib/actions/sailors";
import { DeleteSailorButton } from "@/components/delete-sailor-button";

type Props = { params: Promise<{ id: string }> };

export default async function EditSeglerPage({ params }: Props) {
  const { id } = await params;

  const [sailor, helmEntries, crewEntries] = await Promise.all([
    db.sailor.findUnique({ where: { id } }),
    db.teamEntry.findMany({
      where: { helmId: id },
      include: {
        regatta: { select: { id: true, name: true, startDate: true, completedRaces: true } },
        crew: { select: { firstName: true, lastName: true } },
        result: { select: { finalRank: true, finalPoints: true } },
      },
      orderBy: { regatta: { startDate: "desc" } },
    }),
    db.teamEntry.findMany({
      where: { crewId: id },
      include: {
        regatta: { select: { id: true, name: true, startDate: true, completedRaces: true } },
        helm: { select: { firstName: true, lastName: true } },
        result: { select: { finalRank: true, finalPoints: true } },
      },
      orderBy: { regatta: { startDate: "desc" } },
    }),
  ]);

  if (!sailor) notFound();

  const hasEntries = helmEntries.length > 0 || crewEntries.length > 0;

  async function updateAction(data: FormData) {
    "use server";
    return updateSailor(id, data);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/segler" className="hover:underline">Segler</Link>
        <span>›</span>
        <span>{sailor.lastName}, {sailor.firstName}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Segler bearbeiten</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/segler/merge?secondary=${id}`}
            className="text-xs text-muted-foreground hover:text-foreground border rounded px-2.5 py-1 transition-colors"
            title="Diesen Segler mit einem anderen zusammenführen"
          >
            Mit anderem zusammenführen…
          </Link>
          <DeleteSailorButton id={id} disabled={hasEntries} />
        </div>
      </div>

      <SailorForm sailor={sailor} action={updateAction} />

      {/* Regatta history */}
      {hasEntries && (
        <div className="space-y-4 pt-2">
          <h2 className="text-base font-semibold">Regatta-Historie</h2>

          {helmEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Als Steuermann ({helmEntries.length})
              </h3>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Regatta</th>
                      <th className="px-3 py-2 text-left">Datum</th>
                      <th className="px-3 py-2 text-left">Crew</th>
                      <th className="px-3 py-2 text-center">WF</th>
                      <th className="px-3 py-2 text-right">Platz</th>
                      <th className="px-3 py-2 text-right">Punkte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {helmEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/admin/regatten/${e.regatta.id}`}
                            className="hover:underline text-blue-600"
                          >
                            {e.regatta.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(e.regatta.startDate).toLocaleDateString("de-DE")}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {e.crew
                            ? `${e.crew.firstName} ${e.crew.lastName}`
                            : <span className="italic">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                          {e.regatta.completedRaces}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {e.result?.finalRank ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground font-mono text-xs">
                          {e.result?.finalPoints?.toFixed(1) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {crewEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Als Crew ({crewEntries.length})
              </h3>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Regatta</th>
                      <th className="px-3 py-2 text-left">Datum</th>
                      <th className="px-3 py-2 text-left">Steuermann</th>
                      <th className="px-3 py-2 text-center">WF</th>
                      <th className="px-3 py-2 text-right">Platz</th>
                      <th className="px-3 py-2 text-right">Punkte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {crewEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/admin/regatten/${e.regatta.id}`}
                            className="hover:underline text-blue-600"
                          >
                            {e.regatta.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(e.regatta.startDate).toLocaleDateString("de-DE")}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {e.helm.firstName} {e.helm.lastName}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                          {e.regatta.completedRaces}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {e.result?.finalRank ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground font-mono text-xs">
                          {e.result?.finalPoints?.toFixed(1) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
