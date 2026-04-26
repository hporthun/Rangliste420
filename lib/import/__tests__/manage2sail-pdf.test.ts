import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parsePdfBuffer } from "../manage2sail-pdf";

// Skip tests if fixture PDF not available (CI environments)
const FIXTURE_PATH = resolve(
  process.env.PDF_FIXTURE_PATH ?? "C:/Users/hporthun/Downloads/420__overall_results__10.pdf"
);
const hasPdf = existsSync(FIXTURE_PATH);

describe.skipIf(!hasPdf)("parsePdfBuffer (WaPo 2026 PDF)", () => {
  let result: Awaited<ReturnType<typeof parsePdfBuffer>>;

  beforeAll(async () => {
    const buf = readFileSync(FIXTURE_PATH);
    result = await parsePdfBuffer(new Uint8Array(buf));
  });

  it("parses all 34 entries", () => {
    expect(result.entries.length).toBe(34);
  });

  it("detects 5 races", () => {
    expect(result.numRaces).toBe(5);
  });

  it("rank 1: sail, name, scores", () => {
    const e = result.entries[0];
    expect(e.rank).toBe(1);
    expect(e.sailNumber).toBe("GER 57211");
    expect(e.helmLastName).toBe("TROEGER");
    expect(e.helmFirstName).toBe("Nicolas");
    expect(e.raceScores[0].isDiscard).toBe(true);
    expect(e.raceScores[0].points).toBe(7);
    expect(e.totalPoints).toBe(18);
    expect(e.netPoints).toBe(11);
  });

  it("crew is always null (PDF has no crew)", () => {
    for (const e of result.entries) {
      expect(e.crewFirstName).toBeNull();
      expect(e.crewLastName).toBeNull();
    }
  });

  it("rank 24 (DNC): code attached, inStartAreaSuggestion false", () => {
    const e = result.entries.find((e) => e.rank === 24)!;
    expect(e).toBeDefined();
    const dncScore = e.raceScores.find((s) => s.code === "DNC");
    expect(dncScore).toBeDefined();
    expect(e.inStartAreaSuggestion).toBe(false);
  });

  it("rank 25 (DSQ): code attached", () => {
    const e = result.entries.find((e) => e.rank === 25)!;
    expect(e).toBeDefined();
    expect(e.raceScores.some((s) => s.code === "DSQ")).toBe(true);
  });

  it("rank 28 (DNF): code attached", () => {
    const e = result.entries.find((e) => e.rank === 28)!;
    expect(e).toBeDefined();
    expect(e.raceScores.some((s) => s.code === "DNF")).toBe(true);
  });

  it("rank 32 (DNS): inStartAreaSuggestion true", () => {
    const e = result.entries.find((e) => e.rank === 32)!;
    expect(e).toBeDefined();
    expect(e.inStartAreaSuggestion).toBe(true);
  });

  it("rank 33: sail without country prefix (53036)", () => {
    const e = result.entries.find((e) => e.rank === 33)!;
    expect(e).toBeDefined();
    expect(e.sailNumber).toBe("53036");
  });
});

describe("parsePdfBuffer (unit, no fixture needed)", () => {
  it("returns empty for empty ArrayBuffer", async () => {
    const result = await parsePdfBuffer(new ArrayBuffer(0)).catch(() => ({
      entries: [],
      numRaces: 0,
    }));
    expect(result.entries.length).toBe(0);
  });
});
