import { compareVersions } from "@/lib/changelog";

/**
 * Pure logic for the App-Badge counter (Issue #35). Lives separate from the
 * `<AppBadge>` client component so the comparison rules can be unit-tested
 * without spinning up React.
 */

export type BadgeState = {
  latestChangelogVersion: string | null;
  latestRegattaCreatedAt: string | null;
  latestRankingPublishedAt: string | null;
};

export type SeenState = {
  changelogVersion: string | null;
  regattaCreatedAt: string | null;
  rankingPublishedAt: string | null;
};

export const EMPTY_SEEN: SeenState = {
  changelogVersion: null,
  regattaCreatedAt: null,
  rankingPublishedAt: null,
};

export function isFirstTimeUser(seen: SeenState): boolean {
  return (
    seen.changelogVersion === null &&
    seen.regattaCreatedAt === null &&
    seen.rankingPublishedAt === null
  );
}

/**
 * Each category contributes at most 1 to the count. We deliberately don't
 * count items per category — a single "1" is enough to draw the user back
 * in, and counts of "47 new things" feel noisy.
 */
export function countNew(state: BadgeState, seen: SeenState): number {
  let n = 0;
  if (
    state.latestChangelogVersion &&
    (!seen.changelogVersion ||
      compareVersions(state.latestChangelogVersion, seen.changelogVersion) > 0)
  ) {
    n++;
  }
  if (
    state.latestRegattaCreatedAt &&
    (!seen.regattaCreatedAt ||
      state.latestRegattaCreatedAt > seen.regattaCreatedAt)
  ) {
    n++;
  }
  if (
    state.latestRankingPublishedAt &&
    (!seen.rankingPublishedAt ||
      state.latestRankingPublishedAt > seen.rankingPublishedAt)
  ) {
    n++;
  }
  return n;
}

/**
 * Returns the seen-state-update implied by visiting `pathname`. When the
 * user lands on a listing page, we treat its category as "seen" — because
 * if the listing is in front of them, the badge has done its job.
 */
export function seenPatchFor(
  pathname: string,
  state: BadgeState,
): Partial<SeenState> | null {
  if (pathname.startsWith("/admin/changelog")) {
    return { changelogVersion: state.latestChangelogVersion };
  }
  if (pathname === "/regatten" || pathname.startsWith("/regatten/")) {
    return { regattaCreatedAt: state.latestRegattaCreatedAt };
  }
  if (pathname === "/rangliste" || pathname.startsWith("/rangliste/")) {
    return { rankingPublishedAt: state.latestRankingPublishedAt };
  }
  return null;
}
