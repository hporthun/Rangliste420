import { describe, it, expect } from "vitest";
import { parsePages } from "../sailresults-pdf";
import sailresultsPages from "../__fixtures__/sailresults-pages.json";
import type { RawItem } from "../pdf-utils";

/**
 * Tests for sailresults-pdf.ts using a synthetic RawItem[][] fixture.
 *
 * Fixture layout (sailresults-pages.json):
 *   One page, 4 entries, 3 races.
 *   Entry 1  – bracket discard [5.0] in R2 (SailResults notation, not paren)
 *   Entry 2  – bracket discard [7.0] in R3; Umlaut (MÜLLER)
 *   Entry 3  – split BFD: "[7.0" on main row + "BFD]" on continuation row
 *              → joined as "[7.0 BFD]"; BFD ∈ {DNS,BFD,OCS,UFD} → inStartAreaSuggestion:true
 *   Entry 4  – "[66.0 DNC]" in R1; DNC ∉ {DNS,BFD,OCS,UFD} → inStartAreaSuggestion:false
 *
 * SailResults column order: Netto (net) before Totale (gross) — opposite of Sailwave.
 * Header row detection: requires "Helm" + "Crew" + "Flight" in the same row.
 */

const result = parsePages(sailresultsPages as RawItem[][]);

describe("sailresults-pdf parsePages – structure", () => {
  it("parses 4 entries", () => {
    expect(result.entries).toHaveLength(4);
  });

  it("detects 3 races", () => {
    expect(result.numRaces).toBe(3);
  });
});

describe("sailresults-pdf parsePages – entry 1 (bracket discard)", () => {
  const e = result.entries[0];

  it("rank is 1", () => {
    expect(e.rank).toBe(1);
  });

  it("helm name parsed correctly (hyphenated first name + all-caps last)", () => {
    expect(e.helmFirstName).toBe("Theda-Marieke");
    expect(e.helmLastName).toBe("BRUHNS");
  });

  it("crew parsed", () => {
    expect(e.crewFirstName).toBe("Kai");
    expect(e.crewLastName).toBe("PETERSSON");
  });

  it("sail number prefixed with NAT", () => {
    expect(e.sailNumber).toBe("GER 1234");
  });

  it("R1 is a plain score", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.points).toBe(1.0);
    expect(r1.isDiscard).toBe(false);
    expect(r1.code).toBeUndefined();
  });

  it("R2: bracket discard [5.0] → isDiscard:true, no code (SailResults notation)", () => {
    const r2 = e.raceScores.find((s) => s.race === 2)!;
    expect(r2.isDiscard).toBe(true);
    expect(r2.points).toBe(5.0);
    expect(r2.code).toBeUndefined();
  });

  it("SailResults: netPoints (Netto) and totalPoints (Totale) parsed in column order", () => {
    expect(e.netPoints).toBe(3.0);
    expect(e.totalPoints).toBe(8.0);
  });

  it("no inStartArea trigger", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});

describe("sailresults-pdf parsePages – entry 2 (Umlaut + bracket discard)", () => {
  const e = result.entries[1];

  it("rank is 2", () => {
    expect(e.rank).toBe(2);
  });

  it("Ü in last name handled", () => {
    expect(e.helmLastName).toBe("MÜLLER");
  });

  it("R3: bracket discard [7.0]", () => {
    const r3 = e.raceScores.find((s) => s.race === 3)!;
    expect(r3.isDiscard).toBe(true);
    expect(r3.points).toBe(7.0);
    expect(r3.code).toBeUndefined();
  });
});

describe("sailresults-pdf parsePages – entry 3 (split BFD penalty)", () => {
  const e = result.entries[2];

  it("rank is 3", () => {
    expect(e.rank).toBe(3);
  });

  it("R2: split '[7.0' + 'BFD]' joined, parsed as bracket discard with BFD code", () => {
    const r2 = e.raceScores.find((s) => s.race === 2)!;
    expect(r2.isDiscard).toBe(true);
    expect(r2.points).toBe(7.0);
    expect(r2.code).toBe("BFD");
  });

  it("BFD sets inStartAreaSuggestion:true", () => {
    expect(e.inStartAreaSuggestion).toBe(true);
  });
});

describe("sailresults-pdf parsePages – entry 4 (DNC → no inStartArea)", () => {
  const e = result.entries[3];

  it("rank is 4", () => {
    expect(e.rank).toBe(4);
  });

  it("R1: [66.0 DNC] parsed as bracket discard with DNC code", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.isDiscard).toBe(true);
    expect(r1.points).toBe(66.0);
    expect(r1.code).toBe("DNC");
  });

  it("DNC does not set inStartAreaSuggestion (DNC = not in start area)", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});
