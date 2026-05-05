import { describe, it, expect, vi } from "vitest";

vi.mock("../pdf-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pdf-utils")>();
  return {
    ...actual,
    extractPageItems: vi.fn(),
  };
});

describe("parsePdf – image-only PDF", () => {
  it("throws a clear error when every page has zero text items", async () => {
    const utils = await import("../pdf-utils");
    const { parsePdf } = await import("../pdf-auto-detect");

    vi.mocked(utils.extractPageItems).mockResolvedValueOnce([[], [], [], [], []]);

    await expect(parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).rejects.toThrow(
      /keine Textebene/i
    );
  });

  it("does not trigger the image-only error when at least one page has items", async () => {
    const utils = await import("../pdf-utils");
    const { parsePdf } = await import("../pdf-auto-detect");

    vi.mocked(utils.extractPageItems).mockResolvedValueOnce([
      [],
      [{ str: "irrelevant", x: 0, y: 0 }],
    ]);

    // Falls back to the existing "no entries / not German" error, not the new one
    await expect(parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).rejects.toThrow(
      /Keine Ergebnisse/
    );
  });
});

describe("filterGerman – totalStarters bleibt Pre-Filter (Issue #55)", () => {
  it("totalStarters spiegelt die Gesamtzahl, nicht die GER-gefilterte Anzahl", async () => {
    const { filterGerman } = await import("../pdf-auto-detect");
    const mkEntry = (
      sailNumber: string,
      nationality: string | null = null,
      raceScores: unknown[] = [{}, {}],
    ) => ({
      sailNumber,
      nationality,
      helmName: { firstName: "F", lastName: "L" },
      crewName: null,
      club: null,
      raceScores,
      finalRank: 1,
      finalPoints: 0,
      inStartAreaSuggestion: false,
    } as unknown as Parameters<typeof filterGerman>[0]["entries"][number]);

    const parsed = {
      entries: [
        mkEntry("GER 12345"),
        mkEntry("GER 67890"),
        mkEntry("ITA 111", "ITA"),
        mkEntry("FRA 222", "FRA"),
        mkEntry("999"), // ohne NAT-Prefix → wird als deutsch behandelt
      ],
      numRaces: 2,
      totalStarters: 5,
    };

    const filtered = filterGerman(parsed);
    expect(filtered.totalStarters).toBe(5); // pre-filter
    expect(filtered.entries).toHaveLength(3); // GER + GER + numeric-only
  });

  it("totalStarters bleibt korrekt auch wenn alle Einträge ausgefiltert werden", async () => {
    const { filterGerman } = await import("../pdf-auto-detect");
    const mkForeign = (nat: string) => ({
      sailNumber: `${nat} 1`,
      nationality: nat,
      helmName: { firstName: "F", lastName: "L" },
      crewName: null,
      club: null,
      raceScores: [],
      finalRank: 1,
      finalPoints: 0,
      inStartAreaSuggestion: false,
    } as unknown as Parameters<typeof filterGerman>[0]["entries"][number]);

    const parsed = {
      entries: [mkForeign("ITA"), mkForeign("FRA")],
      numRaces: 0,
      totalStarters: 2,
    };
    const filtered = filterGerman(parsed);
    expect(filtered.totalStarters).toBe(2);
    expect(filtered.entries).toHaveLength(0);
  });
});
