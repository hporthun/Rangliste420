import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { ENTRIES } from "@/lib/changelog";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Public state used by the client-side App Badge (Issue #35).
 *
 * Returns three "latest known" markers — one per badgeable category. Der
 * Client vergleicht sie mit den localStorage-Werten und berechnet die
 * Badge-Zaehlung lokal.
 *
 * Categories
 * - changelog: bumped whenever a new release entry is added (build-time).
 *   ONLY returned for authenticated requests — anonyme Visitors haben keinen
 *   Zugriff auf /admin/changelog, deshalb ist eine Update-Glocke fuer sie
 *   nutzlos (Klick fuehrt zur Login-Wand).
 * - regatta:   newest visible Ranglistenregatta (createdAt)
 * - ranking:   newest published public ranking (publishedAt)
 */
export type BadgeState = {
  latestChangelogVersion: string | null;
  latestRegattaCreatedAt: string | null;
  latestRegattaId: string | null;
  latestRegattaName: string | null;
  latestRankingPublishedAt: string | null;
  latestRankingId: string | null;
  latestRankingName: string | null;
};

export async function GET() {
  const [session, latestRegatta, latestRanking] = await Promise.all([
    auth(),
    db.regatta.findFirst({
      where: { isRanglistenRegatta: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
    }),
    db.ranking.findFirst({
      where: { isPublic: true, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, name: true, publishedAt: true },
    }),
  ]);

  const isSignedIn = !!session?.user;

  const body: BadgeState = {
    // Changelog-Marker nur fuer angemeldete Sitzungen — anonyme Visitors
    // koennen die Detailseite nicht oeffnen, deshalb darf die Glocke ihnen
    // den Eintrag auch nicht anbieten.
    latestChangelogVersion: isSignedIn ? ENTRIES[0]?.version ?? null : null,
    latestRegattaCreatedAt: latestRegatta?.createdAt.toISOString() ?? null,
    latestRegattaId: latestRegatta?.id ?? null,
    latestRegattaName: latestRegatta?.name ?? null,
    latestRankingPublishedAt:
      latestRanking?.publishedAt?.toISOString() ?? null,
    latestRankingId: latestRanking?.id ?? null,
    latestRankingName: latestRanking?.name ?? null,
  };

  return NextResponse.json(body);
}
