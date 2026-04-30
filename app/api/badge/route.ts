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
  latestRankingPublishedAt: string | null;
};

export async function GET() {
  const [latestRegatta, latestRanking] = await Promise.all([
    db.regatta.findFirst({
      where: { isRanglistenRegatta: true },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.ranking.findFirst({
      where: { isPublic: true, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
  ]);

  const body: BadgeState = {
    latestChangelogVersion: ENTRIES[0]?.version ?? null,
    latestRegattaCreatedAt: latestRegatta?.createdAt.toISOString() ?? null,
    latestRankingPublishedAt:
      latestRanking?.publishedAt?.toISOString() ?? null,
  };

  return NextResponse.json(body);
}
