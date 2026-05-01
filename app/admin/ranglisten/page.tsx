import { db } from "@/lib/db/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";
import { RankingsSortableList } from "./sortable-list";

// ── Page-specific tour steps ──────────────────────────────────────────────────

const RANGLISTEN_TOUR: TourStep[] = [
  {
    id: "ranglisten-neu",
    target: '[data-tour="ranglisten-neu"]',
    title: "DSV-Rangliste berechnen",
    content:
      "Berechnet eine Rangliste nach der DSV-Formel RO Anlage 1 §2 " +
      "(gültig ab 01.01.2026): R_A = f × 100 × ((s+1−x)/s). " +
      "Wähle Typ (Jahresrangliste oder Aktuelle Rangliste), " +
      "Zeitraum, Altersklasse und Gender-Kategorie.",
    placement: "bottom-end",
  },
  {
    id: "ranglisten-jwmjem",
    target: '[data-tour="ranglisten-jwmjem"]',
    title: "JWM/JEM-Qualifikation",
    content:
      "Klassenspezifische Sonderregel der 420er-KV: bis zu 3 Regatten auswählen, " +
      "die 2 besten gewichteten Platzierungen werden addiert. " +
      "Nur Steuerleute mit GER-Nationalität zählen.",
    placement: "bottom-end",
  },
  {
    id: "ranglisten-tabelle",
    target: '[data-tour="ranglisten-tabelle"]',
    title: "Gespeicherte Ranglisten",
    content:
      "Mit dem Toggle in der Status-Spalte schaltest du eine Rangliste öffentlich — " +
      "sie erscheint dann auf der Vereinswebsite. " +
      "Über das ···-Menü rechts kannst du die Rangliste umbenennen, " +
      "erneut berechnen oder löschen.",
    placement: "bottom",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RanglistenPage() {
  const rankings = await db.ranking.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      isPublic: true,
      publishedAt: true,
      sortOrder: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ranglisten</h1>
        <div className="flex items-center gap-2">
          <PageTour steps={RANGLISTEN_TOUR} />
          <Link
            href="/admin/ranglisten/vorschau"
            data-tour="ranglisten-neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            + Rangliste berechnen
          </Link>
          <Link
            href="/admin/ranglisten/jwm-jem"
            data-tour="ranglisten-jwmjem"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            + JWM/JEM Quali
          </Link>
        </div>
      </div>

      {rankings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Ranglisten gespeichert.{" "}
          <Link href="/admin/ranglisten/vorschau" className="text-blue-600 hover:underline">
            Rangliste berechnen →
          </Link>
        </p>
      ) : (
        <RankingsSortableList initialRows={rankings} />
      )}
    </div>
  );
}
