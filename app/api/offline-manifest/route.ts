import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Liefert die Liste aller öffentlich erreichbaren Lese-URLs für den
 * Offline-Cache (Service Worker `/sw.js`). Wird vom `OfflinePrefetcher`
 * abgerufen und per `postMessage` an den SW geschickt, der die Seiten
 * dann im Hintergrund vorlädt.
 *
 * Aufgenommen werden:
 *   - Statische Übersichts-Routen (`/`, `/rangliste`, `/regatten`)
 *   - Detailseite + Regatta-Liste jeder veröffentlichten Rangliste
 *   - Steuermann-Detailseiten für jeden Helm in den Regatten der
 *     jeweiligen Rangliste — Supermenge der wirklich gewerteten Helms,
 *     aber unkritisch: 404er werden vom SW nicht gecacht (siehe
 *     `networkFirstPage`).
 *   - Detailseite jeder Regatta
 *
 * Entwürfe (`isPublic=false`) sind anonymen Aufrufen ohnehin als 404
 * versteckt und werden hier nicht aufgenommen.
 */
export async function GET() {
  const [rankings, regattas] = await Promise.all([
    db.ranking.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        rankingRegattas: {
          select: {
            regatta: {
              select: {
                teamEntries: { select: { helmId: true } },
              },
            },
          },
        },
      },
    }),
    db.regatta.findMany({ select: { id: true } }),
  ]);

  const urls: string[] = ["/", "/rangliste", "/regatten"];

  for (const r of rankings) {
    urls.push(`/rangliste/${r.id}`);
    urls.push(`/rangliste/${r.id}/regatten`);
    const helmIds = new Set<string>();
    for (const rr of r.rankingRegattas) {
      for (const te of rr.regatta.teamEntries) {
        helmIds.add(te.helmId);
      }
    }
    for (const helmId of helmIds) {
      urls.push(`/rangliste/${r.id}/steuermann/${helmId}`);
    }
  }

  for (const reg of regattas) {
    urls.push(`/regatta/${reg.id}`);
  }

  return NextResponse.json(
    { urls },
    {
      // Manifest selbst nie cachen — Browser-Cache wäre hier kontraproduktiv,
      // weil wir frisch wissen wollen, was öffentlich ist.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
