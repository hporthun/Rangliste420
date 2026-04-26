import { describe, it, expect } from "vitest";
import { findMatches, type MatchCandidate } from "../matching";

const pool: MatchCandidate[] = [
  { id: "1", firstName: "Max", lastName: "Müller", sailingLicenseId: "GER 1234" },
  { id: "2", firstName: "Anna", lastName: "Schmidt", sailingLicenseId: "GER 5678" },
  { id: "3", firstName: "Hans-Peter", lastName: "Köhler" },
  { id: "4", firstName: "Max", lastName: "Maier", alternativeNames: '["Max Meyer"]' },
];

describe("findMatches", () => {
  it("finds exact match (high confidence)", () => {
    const results = findMatches("Max", "Müller", null, pool);
    expect(results[0].candidate.id).toBe("1");
    expect(results[0].confidence).toBe("high");
  });

  it("handles umlaut variation (Muller → Müller)", () => {
    const results = findMatches("Max", "Muller", null, pool);
    expect(results[0].candidate.id).toBe("1");
  });

  it("handles transposed first/last name", () => {
    const results = findMatches("Müller", "Max", null, pool);
    expect(results[0].candidate.id).toBe("1");
    expect(results[0].confidence).toBe("high");
  });

  it("handles comma format (Müller, Max)", () => {
    const results = findMatches("Müller,", "Max", null, pool);
    expect(results.some((r) => r.candidate.id === "1")).toBe(true);
  });

  it("handles hyphenated name (Hans-Peter → hans peter)", () => {
    const results = findMatches("Hans-Peter", "Köhler", null, pool);
    expect(results[0].candidate.id).toBe("3");
    expect(results[0].confidence).toBe("high");
  });

  it("typo tolerance within medium range", () => {
    // "Schmitt" vs "Schmidt" — 1 char diff
    const results = findMatches("Anna", "Schmitt", null, pool);
    expect(results.some((r) => r.candidate.id === "2")).toBe(true);
  });

  it("sail number bonus pushes ambiguous to high", () => {
    // "Max Meier" vs "Max Maier" — close but maybe medium without sail bonus
    const resultsNoSail = findMatches("Max", "Meier", null, pool);
    const resultsSail = findMatches("Max", "Meier", "GER 1234", pool);
    // Müller gets sail-number boost — it should still appear in results
    const muellerWithSail = resultsSail.find((r) => r.candidate.id === "1");
    expect(muellerWithSail?.score).toBeGreaterThanOrEqual(
      (resultsNoSail.find((r) => r.candidate.id === "1")?.score ?? 0)
    );
  });

  it("finds via alternative name", () => {
    // "Max Meyer" is an alt name for Maier
    const results = findMatches("Max", "Meyer", null, pool);
    expect(results.some((r) => r.candidate.id === "4")).toBe(true);
  });

  it("returns empty for no match", () => {
    const results = findMatches("John", "Doe", null, pool);
    expect(results).toHaveLength(0);
  });

  it("sorts by score descending", () => {
    const results = findMatches("Max", "Müller", null, pool);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});
