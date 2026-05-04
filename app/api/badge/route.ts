import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { ENTRIES } from "@/lib/changelog";

export const dynamic = "force-dynamic";

/**
 * Public state used by the client-side App Badge (Issue #35).
 *
 * Returns three "latest known" markers — one per badgeable category. The
 * client compares them with values stored in localStorage and computes the
 * badge count locally; the server never sees per-user state, so this endpoint
 * needs no auth and can be cached aggressively per-deployment.
 *
 * Categories
 * - changelog: bumped whenever a new release entry is added (build-time)
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
  const [latestRegatta, latestRanking] = await Promise.all([
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

  const body: BadgeState = {
    latestChangelogVersion: ENTRIES[0]?.version ?? null,
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
