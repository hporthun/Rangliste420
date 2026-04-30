import { describe, it, expect } from "vitest";
import { parsePages } from "../sailwave2-pdf";
import sailwave2Pages from "../__fixtures__/sailwave2-pages.json";
import type { RawItem } from "../pdf-utils";

/**
 * Tests for sailwave2-pdf.ts — Sailwave 2.38+ "Crewman" column format.
 *
 * Fixture layout (sailwave2-pages.json), 5 entries, 5 races:
 *   Entry 1 (1st)  – SLO, sail 5686, discard in R5 → filtered (not GER)
 *   Entry 2 (2nd)  – SLO, sail 57193, discard in R1 → filtered (not GER)
 *   Entry 3 (17th) – GER 55251, Jacob Cross / Paul Schmitz; discard in R4 (29)
 *   Entry 4 (34th) – HUN, with "55 DNE" non-discard penalty → filtered (not GER)
 *   Entry 5 (54th) – CRO, all DNC → filtered (not GER)
 *
 * parsePages returns all 5; filterGerman (in pdf-auto-detect) keeps only GER.
 * Here we test parsePages directly (no filter).
 */

const result = parsePages(sailwave2Pages as RawItem[][]);

describe("sailwave2-pdf parsePages – structure", () => {
  it("parses 5 entries total", () => {
    expect(result.entries).toHaveLength(5);
  });

  it("detects 5 races", () => {
    expect(result.numRaces).toBe(5);
  });
});

describe("sailwave2-pdf parsePages – entry 1 (1st, SLO)", () => {
  const e = result.entries[0];

  it("rank is 1", () => {
    expect(e.rank).toBe(1);
  });

  it("sail number with NAT prefix", () => {
    expect(e.sailNumber).toBe("SLO 5686");
  });

  it("nationality is SLO", () => {
    expect(e.nationality).toBe("SLO");
  });

  it("helm name parsed", () => {
    expect(e.helmFirstName).toBe("Lina");
    expect(e.helmLastName).toBe("Sorta");
  });

  it("crew name parsed", () => {
    expect(e.crewFirstName).toBe("Filip");
    expect(e.crewLastName).toBe("Valjavec");
  });

  it("club is crewman 1 club", () => {
    expect(e.club).toBe("JK Pirat");
  });

  it("R5 is a discard", () => {
    const r5 = e.raceScores.find((s) => s.race === 5)!;
    expect(r5.isDiscard).toBe(true);
    expect(r5.points).toBe(5);
  });

  it("netPoints parsed correctly", () => {
    expect(e.netPoints).toBe(4);
  });
});

describe("sailwave2-pdf parsePages – entry 3 (17th, GER)", () => {
  const e = result.entries[2];

  it("rank is 17", () => {
    expect(e.rank).toBe(17);
  });

  it("sail number with GER prefix", () => {
    expect(e.sailNumber).toBe("GER 55251");
  });

  it("nationality is GER", () => {
    expect(e.nationality).toBe("GER");
  });

  it("helm name: Jacob Cross", () => {
    expect(e.helmFirstName).toBe("Jacob");
    expect(e.helmLastName).toBe("Cross");
  });

  it("crew name: Paul Schmitz", () => {
    expect(e.crewFirstName).toBe("Paul");
    expect(e.crewLastName).toBe("Schmitz");
  });

  it("R4 is a discard (29)", () => {
    const r4 = e.raceScores.find((s) => s.race === 4)!;
    expect(r4.isDiscard).toBe(true);
    expect(r4.points).toBe(29);
  });

  it("no inStartArea (discard is plain 29, no start-area code)", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});

describe("sailwave2-pdf parsePages – entry 4 (34th, HUN, DNE non-discard)", () => {
  const e = result.entries[3];

  it("rank is 34", () => {
    expect(e.rank).toBe(34);
  });

  it("R4 is 55 DNE — not a discard, penalty code DNE", () => {
    const r4 = e.raceScores.find((s) => s.race === 4)!;
    expect(r4.points).toBe(55);
    expect(r4.code).toBe("DNE");
    expect(r4.isDiscard).toBe(false);
  });

  it("R1 is a discard (31)", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.isDiscard).toBe(true);
    expect(r1.points).toBe(31);
  });
});

describe("sailwave2-pdf parsePages – entry 5 (54th, CRO, all DNC)", () => {
  const e = result.entries[4];

  it("rank is 54", () => {
    expect(e.rank).toBe(54);
  });

  it("R1 is a discarded DNC (55)", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.isDiscard).toBe(true);
    expect(r1.points).toBe(55);
    expect(r1.code).toBe("DNC");
  });

  it("R2–R5 are non-discard DNC (55)", () => {
    for (const race of [2, 3, 4, 5]) {
      const r = e.raceScores.find((s) => s.race === race)!;
      expect(r.points).toBe(55);
      expect(r.code).toBe("DNC");
      expect(r.isDiscard).toBe(false);
    }
  });
});

describe("sailwave2-pdf detectPdfFormat", () => {
  it("'Crewman 1' in page texts triggers sailwave2 format", async () => {
    const { detectPdfFormat } = await import("../pdf-auto-detect");
    expect(detectPdfFormat(["Rank", "Crewman 1", "Name", "Nett"])).toBe("sailwave2");
  });

  it("'Crewman 2' also triggers sailwave2", async () => {
    const { detectPdfFormat } = await import("../pdf-auto-detect");
    expect(detectPdfFormat(["Rank", "Crewman 2", "Name", "Nett"])).toBe("sailwave2");
  });

  it("'CrewName' (old format) is still detected as sailwave", async () => {
    const { detectPdfFormat } = await import("../pdf-auto-detect");
    expect(detectPdfFormat(["sailno", "CrewName", "Netto"])).toBe("sailwave");
  });
});
