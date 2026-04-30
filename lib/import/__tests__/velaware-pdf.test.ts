import { describe, it, expect } from "vitest";
import { parsePages } from "../velaware-pdf";
import velawarePages from "../__fixtures__/velaware-pages.json";
import type { RawItem } from "../pdf-utils";

/**
 * Tests for velaware-pdf.ts using a synthetic RawItem[][] fixture derived
 * from the "Imperia Winter Regatta 2025" PDF.
 *
 * The Velaware quirk: the visual "Numero velico" column has two sub-cells
 * (NAT code on the left, digit sail number on the right) but only one
 * header. Tests verify all four edge cases observed in real PDFs:
 *   Entry 1 (rank 1)   – ESP, 5-digit sail at the typical x position
 *   Entry 2 (rank 16)  – ESP, 4-digit sail at a slightly right-shifted x
 *                        (would have leaked into the "Nome" column with the
 *                        old midpoint-only column boundaries)
 *   Entry 3 (rank 24)  – ITA, 2-digit sail far right of the NAT code
 *   Entry 4 (rank 25)  – GER, plain domestic-style row
 */

const result = parsePages(velawarePages as RawItem[][]);

describe("velaware-pdf parsePages – structure", () => {
  it("parses 4 entries", () => {
    expect(result.entries).toHaveLength(4);
  });

  it("detects 6 races", () => {
    expect(result.numRaces).toBe(6);
  });
});

describe("velaware-pdf parsePages – entry 1 (ESP, typical row)", () => {
  const e = result.entries[0];

  it("rank is 1", () => {
    expect(e.rank).toBe(1);
  });

  it("sail number includes NAT prefix and digits", () => {
    expect(e.sailNumber).toBe("ESP 55249");
  });

  it("nationality is set to ESP", () => {
    expect(e.nationality).toBe("ESP");
  });

  it("helm name parsed (no all-caps surname → first word is firstName)", () => {
    expect(e.helmFirstName).toBe("Lluc");
    expect(e.helmLastName).toBe("Garcés Burgués");
  });

  it("crew name parsed", () => {
    expect(e.crewFirstName).toBe("Federico");
    expect(e.crewLastName).toBe("Blanco Doménech");
  });

  it("club parsed", () => {
    expect(e.club).toBe("Club Nàutico el Balís");
  });

  it("net points parsed (Italian comma decimal)", () => {
    expect(e.netPoints).toBe(63);
  });

  it("R5 score is plain integer", () => {
    const r5 = e.raceScores.find((s) => s.race === 5)!;
    expect(r5.points).toBe(2);
    expect(r5.isDiscard).toBe(false);
  });
});

describe("velaware-pdf parsePages – entry 2 (ESP, short sail number, right-shifted)", () => {
  const e = result.entries[1];

  it("rank is 16", () => {
    expect(e.rank).toBe(16);
  });

  it("sail number 5759 ends up in sail column, not in helm name", () => {
    expect(e.sailNumber).toBe("ESP 5759");
  });

  it("nationality is set to ESP", () => {
    expect(e.nationality).toBe("ESP");
  });

  it("helm name does NOT contain the leaked sail digits", () => {
    expect(e.helmFirstName).not.toMatch(/5759/);
    expect(e.helmLastName).not.toMatch(/5759/);
  });

  it("R6 BFD code triggers inStartArea suggestion", () => {
    expect(e.inStartAreaSuggestion).toBe(true);
    const r6 = e.raceScores.find((s) => s.race === 6)!;
    expect(r6.code).toBe("BFD");
  });
});

describe("velaware-pdf parsePages – entry 3 (ITA, 2-digit sail)", () => {
  const e = result.entries[2];

  it("rank is 24", () => {
    expect(e.rank).toBe(24);
  });

  it("sail number 'ITA 11' parsed correctly", () => {
    expect(e.sailNumber).toBe("ITA 11");
  });

  it("nationality is set to ITA", () => {
    expect(e.nationality).toBe("ITA");
  });

  it("helm name does NOT contain the leaked sail digit '11'", () => {
    expect(e.helmFirstName).toBe("Bianca");
    expect(e.helmLastName).toBe("Guglieri");
  });
});

describe("velaware-pdf parsePages – entry 4 (GER, domestic-style)", () => {
  const e = result.entries[3];

  it("rank is 25", () => {
    expect(e.rank).toBe(25);
  });

  it("sail number includes GER prefix", () => {
    expect(e.sailNumber).toBe("GER 57160");
  });

  it("nationality is set to GER", () => {
    expect(e.nationality).toBe("GER");
  });

  it("helm name parsed (title-case heuristic: first word → firstName, rest → lastName)", () => {
    expect(e.helmFirstName).toBe("Noel");
    expect(e.helmLastName).toBe("Jonas Theiner");
  });
});
