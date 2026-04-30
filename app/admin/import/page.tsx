import { db } from "@/lib/db/client";
import { ImportWizard } from "@/components/import-wizard/wizard";

type Props = {
  searchParams: Promise<{ regattaId?: string; m2sUrl?: string }>;
};

export default async function ImportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialRegattaId = sp.regattaId ?? undefined;
  const initialM2sUrl = sp.m2sUrl ?? undefined;

  const rawRegattas = await db.regatta.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      completedRaces: true,
      ranglistenFaktor: true,
      totalStarters: true,
    },
  });

  const regattas = rawRegattas.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate.toISOString(),
    completedRaces: r.completedRaces,
    ranglistenFaktor: Number(r.ranglistenFaktor),
    totalStarters: r.totalStarters,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ergebnisse importieren</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage2Sail-Ergebnisse per API, Web-Copy-Paste oder PDF importieren.
        </p>
      </div>
      <ImportWizard
        regattas={regattas}
        initialRegattaId={initialRegattaId}
        initialM2sUrl={initialM2sUrl}
      />
    </div>
  );
}
