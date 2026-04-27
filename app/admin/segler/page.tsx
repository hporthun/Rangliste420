import Link from "next/link";
import { db } from "@/lib/db/client";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/search-input";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";

export const dynamic = "force-dynamic";

// ── Page-specific tour steps ──────────────────────────────────────────────────

const SEGLER_TOUR: TourStep[] = [
  {
    id: "segler-neu",
    target: '[data-tour="segler-neu"]',
    title: "Segler anlegen",
    content:
      "Legt einen neuen Segler manuell an. " +
      "Geburtsjahr und Geschlecht sind optional, werden aber für " +
      "Alters- und Gender-Kategorien (U15–U19, Männer, Girls) benötigt — " +
      "Segler ohne diese Daten erscheinen nur in der Open-Kategorie.",
    placement: "bottom-end",
  },
  {
    id: "segler-import",
    target: '[data-tour="segler-import"]',
    title: "Stammdaten importieren",
    content:
      "Importiert mehrere Segler auf einmal aus einer CSV-Datei. " +
      "Praktisch, wenn ein Manage2Sail-Export oder eine Vereinsliste vorliegt. " +
      "Bestehende Segler werden über Fuzzy-Matching erkannt und nicht doppelt angelegt.",
    placement: "bottom-end",
  },
  {
    id: "segler-suche",
    target: '[data-tour="segler-suche"]',
    title: "Schnellsuche",
    content:
      "Filtert die Liste sofort nach Name (Vor- oder Nachname). " +
      "Der Suchbegriff wird als URL-Parameter gespeichert — " +
      "du kannst ihn also direkt verlinken oder im Browser-Tab behalten.",
    placement: "bottom",
  },
  {
    id: "segler-tabelle",
    target: '[data-tour="segler-tabelle"]',
    title: "Seglerliste",
    content:
      "Gelb hinterlegte Zeilen haben unvollständige Stammdaten. " +
      "Das ⚠-Symbol markiert Segler ohne Geburtsjahr oder Geschlecht — " +
      "klicke auf den Namen, um die fehlenden Daten zu ergänzen. " +
      "Die Spalte 'Regatten' zählt alle Teilnahmen als Steuermann oder Crew.",
    placement: "bottom",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SeglerPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const sailors = await db.sailor.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { helmEntries: true, crewEntries: true } },
    },
  });

  const warnings = sailors.filter((s) => !s.birthYear || !s.gender);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Segler ({sailors.length}{q && " gefunden"})
        </h1>
        <div className="flex items-center gap-2">
          <PageTour steps={SEGLER_TOUR} />
          <Link
            href="/admin/segler/import"
            data-tour="segler-import"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Stammdaten importieren
          </Link>
          <Link
            href="/admin/segler/neu"
            data-tour="segler-neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            + Neuer Segler
          </Link>
        </div>
      </div>

      {/* Suchfeld */}
      <div data-tour="segler-suche">
        <SearchInput placeholder="Name suchen…" paramName="q" initialValue={q} />
      </div>

      {warnings.length > 0 && !q && (
        <div
          data-tour="segler-warnung"
          className="flex items-start gap-2 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {warnings.length} Segler ohne vollständige Stammdaten — diese werden aus
            Alters- und Gender-Ranglisten ausgeschlossen.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded border" data-tour="segler-tabelle">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Verein</th>
              <th className="px-3 py-2 text-left font-medium">Nat.</th>
              <th className="px-3 py-2 text-left font-medium">Geb.</th>
              <th className="px-3 py-2 text-left font-medium">Geschlecht</th>
              <th className="px-3 py-2 text-left font-medium">Regatten</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sailors.map((s) => {
              const missing = !s.birthYear || !s.gender;
              return (
                <tr key={s.id} className={missing ? "bg-yellow-50/50" : ""}>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/admin/segler/${s.id}`} className="hover:underline">
                      {s.lastName}, {s.firstName}
                    </Link>
                    {missing && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-yellow-500" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.club ?? "—"}</td>
                  <td className="px-3 py-2">{s.nationality}</td>
                  <td className="px-3 py-2">
                    {s.birthYear ?? <span className="text-yellow-600">fehlt</span>}
                  </td>
                  <td className="px-3 py-2">
                    {s.gender === "M"
                      ? "männlich"
                      : s.gender === "F"
                      ? "weiblich"
                      : <span className="text-yellow-600">fehlt</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s._count.helmEntries + s._count.crewEntries}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/segler/${s.id}`}
                      className="mr-3 text-xs text-blue-600 hover:underline"
                    >
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              );
            })}
            {sailors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {q ? `Keine Segler für „${q}" gefunden.` : "Noch keine Segler angelegt."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
