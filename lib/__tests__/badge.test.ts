import { describe, it, expect } from "vitest";
import {
  countNew,
  isFirstTimeUser,
  seenPatchFor,
  EMPTY_SEEN,
  type BadgeState,
} from "../badge";

const STATE: BadgeState = {
  latestChangelogVersion: "2026.04.26",
  latestRegattaCreatedAt: "2026-04-30T08:00:00.000Z",
  latestRankingPublishedAt: "2026-04-29T12:00:00.000Z",
};

describe("countNew", () => {
  it("zählt jede Kategorie maximal einmal", () => {
    expect(countNew(STATE, EMPTY_SEEN)).toBe(3);
  });

  it("alles bereits gesehen → 0", () => {
    expect(
      countNew(STATE, {
        changelogVersion: STATE.latestChangelogVersion,
        regattaCreatedAt: STATE.latestRegattaCreatedAt,
        rankingPublishedAt: STATE.latestRankingPublishedAt,
      }),
    ).toBe(0);
  });

  it("nur Changelog neu → 1", () => {
    expect(
      countNew(STATE, {
        changelogVersion: "2026.04.20",
        regattaCreatedAt: STATE.latestRegattaCreatedAt,
        rankingPublishedAt: STATE.latestRankingPublishedAt,
      }),
    ).toBe(1);
  });

  it("Changelog älter als gesehen → nicht gezählt", () => {
    expect(
      countNew(STATE, {
        changelogVersion: "2026.05.01",
        regattaCreatedAt: STATE.latestRegattaCreatedAt,
        rankingPublishedAt: STATE.latestRankingPublishedAt,
      }),
    ).toBe(0);
  });

  it("Server liefert null → Kategorie zählt nicht", () => {
    const partial: BadgeState = {
      latestChangelogVersion: null,
      latestRegattaCreatedAt: null,
      latestRankingPublishedAt: null,
    };
    expect(countNew(partial, EMPTY_SEEN)).toBe(0);
  });

  it("ISO-Zeitstempel werden lexikografisch verglichen (gleicher Tag, neuere Stunde)", () => {
    expect(
      countNew(STATE, {
        changelogVersion: STATE.latestChangelogVersion,
        regattaCreatedAt: "2026-04-30T07:59:59.000Z",
        rankingPublishedAt: STATE.latestRankingPublishedAt,
      }),
    ).toBe(1);
  });
});

describe("isFirstTimeUser", () => {
  it("alles null → true", () => {
    expect(isFirstTimeUser(EMPTY_SEEN)).toBe(true);
  });

  it("ein Wert gesetzt → false", () => {
    expect(
      isFirstTimeUser({ ...EMPTY_SEEN, changelogVersion: "2026.04.10" }),
    ).toBe(false);
  });
});

describe("seenPatchFor", () => {
  it("/admin/changelog → markiert Changelog", () => {
    expect(seenPatchFor("/admin/changelog", STATE)).toEqual({
      changelogVersion: STATE.latestChangelogVersion,
    });
  });

  it("/regatten → markiert Regatta", () => {
    expect(seenPatchFor("/regatten", STATE)).toEqual({
      regattaCreatedAt: STATE.latestRegattaCreatedAt,
    });
  });

  it("/regatten/<id> → markiert Regatta", () => {
    expect(seenPatchFor("/regatten/abc123", STATE)).toEqual({
      regattaCreatedAt: STATE.latestRegattaCreatedAt,
    });
  });

  it("/rangliste → markiert Rangliste", () => {
    expect(seenPatchFor("/rangliste", STATE)).toEqual({
      rankingPublishedAt: STATE.latestRankingPublishedAt,
    });
  });

  it("Andere Pfade → null", () => {
    expect(seenPatchFor("/", STATE)).toBeNull();
    expect(seenPatchFor("/admin", STATE)).toBeNull();
    expect(seenPatchFor("/admin/regatten", STATE)).toBeNull();
  });
});
