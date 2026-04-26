import { describe, it, expect } from "vitest";
import { parsePages } from "../sailwave-pdf";
import sailwavePages from "../__fixtures__/sailwave-pages.json";
import type { RawItem } from "../pdf-utils";

/**
 * Tests for sailwave-pdf.ts using a synthetic RawItem[][] fixture.
 *
 * Fixture layout (sailwave-pages.json):
 *   One page, 5 entries, 3 races.
 *   Entry 1  – name wraps across two PDF lines ("Theda-Marieke" + "BRUHNS")
 *   Entry 2  – Umlaut in last name (MÜLLER)
 *   Entry 3  – split DNC penalty: "(56.0" on main row + "DNC)" on continuation row
 *              → joined as "(56.0 DNC)"; DNC ∉ {DNS,BFD,OCS,UFD} → inStartAreaSuggestion:false
 *   Entry 4  – "(56.0 DNS)" in R1 → DNS ∈ {DNS,BFD,OCS,UFD} → inStartAreaSuggestion:true
 *   Entry 5  – all normal scores, no special cases
 *
 * Sailwave column order: Totale (gross) before Netto (net) — opposite of SailResults.
 */

const result = parsePages(sailwavePages as RawItem[][]);

describe("sailwave-pdf parsePages – structure", () => {
  it("parses 5 entries", () => {
    expect(result.entries).toHaveLength(5);
  });

  it("detects 3 races", () => {
    expect(result.numRaces).toBe(3);
  });
});

describe("sailwave-pdf parsePages – entry 1 (name wrap)", () => {
  const e = result.entries[0];

  it("rank is 1", () => {
    expect(e.rank).toBe(1);
  });

  it("helm name assembled from two PDF lines", () => {
    expect(e.helmFirstName).toBe("Theda-Marieke");
    expect(e.helmLastName).toBe("BRUHNS");
  });

  it("crew parsed from single line", () => {
    expect(e.crewFirstName).toBe("Kai");
    expect(e.crewLastName).toBe("PETERSSON");
  });

  it("sail number prefixed with NAT", () => {
    expect(e.sailNumber).toBe("GER 1234");
  });

  it("club parsed", () => {
    expect(e.club).toBe("KV Kiel");
  });

  it("R1 is a plain score (not discard)", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.points).toBe(1.0);
    expect(r1.isDiscard).toBe(false);
    expect(r1.code).toBeUndefined();
  });

  it("R2 is a discard (paren notation), no penalty code", () => {
    const r2 = e.raceScores.find((s) => s.race === 2)!;
    expect(r2.isDiscard).toBe(true);
    expect(r2.points).toBe(3.0);
    expect(r2.code).toBeUndefined();
  });

  it("Sailwave: totalPoints (Totale) and netPoints (Netto) parsed", () => {
    expect(e.totalPoints).toBe(6.0);
    expect(e.netPoints).toBe(3.0);
  });

  it("no inStartArea trigger", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});

describe("sailwave-pdf parsePages – entry 2 (Umlaut)", () => {
  const e = result.entries[1];

  it("rank is 2", () => {
    expect(e.rank).toBe(2);
  });

  it("Ü in last name parsed correctly", () => {
    expect(e.helmLastName).toBe("MÜLLER");
    expect(e.helmFirstName).toBe("Jan");
  });

  it("R3 is a discard (paren notation)", () => {
    const r3 = e.raceScores.find((s) => s.race === 3)!;
    expect(r3.isDiscard).toBe(true);
    expect(r3.points).toBe(4.0);
  });
});

describe("sailwave-pdf parsePages – entry 3 (split DNC penalty)", () => {
  const e = result.entries[2];

  it("rank is 3", () => {
    expect(e.rank).toBe(3);
  });

  it("R3: split '(56.0' + 'DNC)' joined into one cell, parsed as discard+code", () => {
    const r3 = e.raceScores.find((s) => s.race === 3)!;
    expect(r3.isDiscard).toBe(true);
    expect(r3.points).toBe(56.0);
    expect(r3.code).toBe("DNC");
  });

  it("DNC does not set inStartAreaSuggestion (DNC = not in start area)", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});

describe("sailwave-pdf parsePages – entry 4 (DNS → inStartArea)", () => {
  const e = result.entries[3];

  it("rank is 4", () => {
    expect(e.rank).toBe(4);
  });

  it("R1: DNS code attached to discard penalty", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.isDiscard).toBe(true);
    expect(r1.points).toBe(56.0);
    expect(r1.code).toBe("DNS");
  });

  it("DNS sets inStartAreaSuggestion:true", () => {
    expect(e.inStartAreaSuggestion).toBe(true);
  });
});

describe("sailwave-pdf parsePages – entry 5 (all normal)", () => {
  const e = result.entries[4];

  it("rank is 5", () => {
    expect(e.rank).toBe(5);
  });

  it("all 3 race scores present and none are discard", () => {
    expect(e.raceScores).toHaveLength(3);
    expect(e.raceScores.every((s) => !s.isDiscard)).toBe(true);
  });

  it("no inStartArea trigger", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});
