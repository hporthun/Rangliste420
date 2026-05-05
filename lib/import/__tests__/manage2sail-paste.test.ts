import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseName, parsePaste } from "../manage2sail-paste";

const fixture = readFileSync(
  resolve(__dirname, "../__fixtures__/wapo2026-paste.txt"),
  "utf-8"
);

describe("parsePaste (WaPo 2026 fixture)", () => {
  const result = parsePaste(fixture);

  it("parses all entries", () => {
    expect(result.entries.length).toBe(11);
  });

  it("detects 5 races", () => {
    expect(result.numRaces).toBe(5);
  });

  it("parses rank 1 correctly", () => {
    const e = result.entries[0];
    expect(e.rank).toBe(1);
    expect(e.sailNumber).toBe("GER 57211");
    expect(e.helmFirstName).toBe("Nicolas");
    expect(e.helmLastName).toBe("TROEGER");
    expect(e.crewFirstName).toBe("Max");
    expect(e.crewLastName).toBe("KÖNIG");
    expect(e.club).toBe("BYCUE");
    expect(e.totalPoints).toBe(18.0);
    expect(e.netPoints).toBe(11.0);
  });

  it("marks discard race correctly (rank 1, R1)", () => {
    const scores = result.entries[0].raceScores;
    expect(scores[0].isDiscard).toBe(true);
    expect(scores[0].points).toBe(7.0);
    expect(scores[1].isDiscard).toBe(false);
  });

  it("parses compound first name (Nikolaus von LUCKNER)", () => {
    const e = result.entries.find((e) => e.helmLastName === "BAYER");
    expect(e?.crewFirstName).toBe("Nikolaus von");
    expect(e?.crewLastName).toBe("LUCKNER");
  });

  it("attaches DNC code after discard score (rank 24)", () => {
    const e = result.entries.find((e) => e.rank === 24)!;
    expect(e.raceScores[0].code).toBe("DNC");
    expect(e.raceScores[0].isDiscard).toBe(true);
    expect(e.raceScores.length).toBe(5);
  });

  it("attaches DSQ code after discard score (rank 25)", () => {
    const e = result.entries.find((e) => e.rank === 25)!;
    const disq = e.raceScores.find((s) => s.code === "DSQ");
    expect(disq).toBeDefined();
    expect(disq?.isDiscard).toBe(true);
  });

  it("attaches DNF code (rank 28)", () => {
    const e = result.entries.find((e) => e.rank === 28)!;
    expect(e.raceScores[0].code).toBe("DNF");
  });

  it("attaches DNS code (rank 32)", () => {
    const e = result.entries.find((e) => e.rank === 32)!;
    const dns = e.raceScores.find((s) => s.code === "DNS");
    expect(dns).toBeDefined();
  });

  it("parses sail number without country prefix (rank 33)", () => {
    const e = result.entries.find((e) => e.rank === 33)!;
    expect(e.sailNumber).toBe("53036");
  });

  it("inStartAreaSuggestion: true for DNS (rank 32)", () => {
    const e = result.entries.find((e) => e.rank === 32)!;
    expect(e.inStartAreaSuggestion).toBe(true);
  });

  it("inStartAreaSuggestion: false for DNC (rank 24)", () => {
    const e = result.entries.find((e) => e.rank === 24)!;
    expect(e.inStartAreaSuggestion).toBe(false);
  });

  it("inStartAreaSuggestion: false for DNF (rank 28)", () => {
    const e = result.entries.find((e) => e.rank === 28)!;
    expect(e.inStartAreaSuggestion).toBe(false);
  });

  it("parses multiple codes in one entry (rank 34)", () => {
    const e = result.entries.find((e) => e.rank === 34)!;
    const codedScores = e.raceScores.filter((s) => s.code);
    expect(codedScores.length).toBe(3);
    expect(e.raceScores.length).toBe(5);
  });
});

describe("parsePaste edge cases", () => {
  it("returns empty entries for empty input", () => {
    expect(parsePaste("").entries).toHaveLength(0);
  });

  it("returns empty entries for header-only input", () => {
    const headerOnly = "Nr\tSegel Nummer\t\nMannschaft\nVerein\tT.\tN.\tR1\tR2\n";
    expect(parsePaste(headerOnly).entries).toHaveLength(0);
  });
});

describe("parseName (Issue #65: Initialen-Edge-Cases)", () => {
  it("Initial mit Punkt: 'Eckhard A. SCHMIDT'", () => {
    expect(parseName("Eckhard A. SCHMIDT")).toEqual({
      firstName: "Eckhard A.",
      lastName: "SCHMIDT",
    });
  });

  it("Single-Letter-Initialen am Anfang: 'A M SCHMIDT'", () => {
    expect(parseName("A M SCHMIDT")).toEqual({
      firstName: "A M",
      lastName: "SCHMIDT",
    });
  });

  it("All-caps Doppel-Nachname: 'Jean Claude PETIT DUPONT'", () => {
    expect(parseName("Jean Claude PETIT DUPONT")).toEqual({
      firstName: "Jean Claude",
      lastName: "PETIT DUPONT",
    });
  });

  it("Hyphenated firstName: 'Klaus-Dieter MÜLLER'", () => {
    expect(parseName("Klaus-Dieter MÜLLER")).toEqual({
      firstName: "Klaus-Dieter",
      lastName: "MÜLLER",
    });
  });

  it("Nobiliar-Partikel all-caps: 'Hans-Peter VON KRUSE'", () => {
    expect(parseName("Hans-Peter VON KRUSE")).toEqual({
      firstName: "Hans-Peter",
      lastName: "VON KRUSE",
    });
  });

  it("Mehrteiliges Nobiliar-Partikel: 'Klaus VON DER MARK'", () => {
    expect(parseName("Klaus VON DER MARK")).toEqual({
      firstName: "Klaus",
      lastName: "VON DER MARK",
    });
  });

  it("Initial mit Punkt zwischen Vor- und Nachnamen: 'Ali B. CABRAL'", () => {
    expect(parseName("Ali B. CABRAL")).toEqual({
      firstName: "Ali B.",
      lastName: "CABRAL",
    });
  });
});
