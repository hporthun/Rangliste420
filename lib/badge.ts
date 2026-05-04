import { compareVersions } from "@/lib/changelog";

/**
 * Pure logic for the App-Badge counter (Issue #35). Lives separate from the
 * `<AppBadge>` client component so the comparison rules can be unit-tested
 * without spinning up React.
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
 * Eintrag im Update-Indicator-Dropdown.
 * `kind` markiert die Kategorie, `href` ist das Klick-Ziel (entweder
 * Detailseite des konkreten Items oder Listing als Fallback).
 */
export type UnreadItem = {
  kind: "ranking" | "regatta" | "changelog";
  label: string;
  href: string;
};

/**
 * Bestimmt aus state vs. seen die ungelesenen Kategorien — als Liste mit
 * Anzeige-Label und Sprungziel. Reihenfolge: Ranking, Regatta, Changelog
 * (typisch wichtigster Inhalt zuerst). Wird vom UpdateIndicator-Banner
 * verwendet, um pro Kategorie einen Klick-Link anzuzeigen.
 */
export function unreadItems(
  state: BadgeState,
  seen: SeenState,
): UnreadItem[] {
  const items: UnreadItem[] = [];
  if (
    state.latestRankingPublishedAt &&
    (!seen.rankingPublishedAt ||
      state.latestRankingPublishedAt > seen.rankingPublishedAt)
  ) {
    items.push({
      kind: "ranking",
      label: state.latestRankingName ?? "Neue Rangliste",
      href: state.latestRankingId
        ? `/rangliste/${state.latestRankingId}`
        : "/rangliste",
    });
  }
  if (
    state.latestRegattaCreatedAt &&
    (!seen.regattaCreatedAt ||
      state.latestRegattaCreatedAt > seen.regattaCreatedAt)
  ) {
    items.push({
      kind: "regatta",
      label: state.latestRegattaName ?? "Neue Regatta",
      href: state.latestRegattaId
        ? `/regatta/${state.latestRegattaId}`
        : "/regatten",
    });
  }
  if (
    state.latestChangelogVersion &&
    (!seen.changelogVersion ||
      compareVersions(state.latestChangelogVersion, seen.changelogVersion) > 0)
  ) {
    items.push({
      kind: "changelog",
      label: `App-Update ${state.latestChangelogVersion}`,
      href: "/admin/changelog",
    });
  }
  return items;
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
