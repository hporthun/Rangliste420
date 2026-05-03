"use client";

/**
 * Action-Leiste fuer eingeloggte Benutzer auf der Ranglisten-Detailseite.
 *
 * - Excel-Export: Link auf /api/rangliste/<id>/export.xlsx mit aktuellen
 *   age/gender-Filtern in der URL.
 * - Drucken: window.print(); das Print-Stylesheet in globals.css blendet
 *   Filter, Suche und diese Buttons aus.
 *
 * Wird ausschliesslich gerendert, wenn die Server-Komponente eine Session
 * festgestellt hat — die Buttons selbst pruefen kein Auth.
 */

import Link from "next/link";

export function RankingsActions({
  exportHref,
}: {
  exportHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden" data-print-hide>
      <Link
        href={exportHref}
        className="inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 hover:bg-muted/60 transition-colors"
        prefetch={false}
      >
        <span aria-hidden>↓</span> Excel-Export
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 hover:bg-muted/60 transition-colors"
      >
        <span aria-hidden>🖶</span> Drucken / PDF
      </button>
    </div>
  );
}
