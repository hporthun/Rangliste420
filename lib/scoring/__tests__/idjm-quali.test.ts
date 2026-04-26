import { describe, it, expect } from "vitest";
import { calculateIdjmQuali, IDJM_MIN_R } from "../idjm-quali";
import type { RegattaData, ResultData } from "../dsv";

let _id = 0;
function uid() { return `id-${++_id}`; }

function mkResult(
  helmId: string,
  finalRank: number,
  helmBirth: number,
  helmGender: string,
  crewBirth: number,
  crewGender: string
): ResultData {
  const helm = { id: helmId, birthYear: helmBirth, gender: helmGender };
  const crew = { id: uid(), birthYear: crewBirth, gender: crewGender };
  return {
    id: uid(),
    teamEntry: { helmId, crewId: crew.id, helm, crew },
    finalRank,
    inStartArea: false,
  };
}

function mkRegatta(startDate: string, results: ResultData[]): RegattaData {
  return {
    id: uid(),
    ranglistenFaktor: 1.0,
    completedRaces: 1,
    multiDayAnnouncement: false,
    startDate: new Date(startDate),
    results,
  };
}

describe("calculateIdjmQuali", () => {
  describe("R ≥ 25 threshold", () => {
    it("R < 25 → excluded", () => {
      // f=1, s=100, x=77 → R_A = 100*24/100 = 24 → R = 24 < 25
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 77, 2007, "M", 2007, "F");
        const filler = Array.from({ length: 99 }, (_, i) => mkResult(uid(), i + 1, 2007, "M", 2007, "F"));
        return mkRegatta("2025-06-01", [r, ...filler]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "OPEN", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("R ≥ 25 → included", () => {
      const helmId = uid();
      // f=1, s=2, x=1 → R_A=100; 9 values → R=100 ≥ 25
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2007, "M", 2007, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2007, "M", 2007, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "OPEN", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeDefined();
    });
  });

  describe("per-regatta age check (year-based)", () => {
    it("crew born 2006 (refYear 2025 → age 19): excluded from all 2025 regattas", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2007, "M", 2006, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2007, "M", 2007, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "OPEN", regattas: regs });
      // No qualifying values → not listed
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("crew born 2007 (refYear 2025 → age 18): included in all 2025 regattas", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2007, "M", 2007, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2007, "M", 2007, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "OPEN", regattas: regs });
      const entry = rankings.find((r) => r.helmId === helmId);
      expect(entry).toBeDefined();
      expect(entry!.allValues.length).toBe(9);
    });

    it("helm too old → excluded", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2000, "M", 2007, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2007, "M", 2007, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "OPEN", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });

  describe("U16 age category", () => {
    it("U16 (max 15, refYear 2025 → birthYear ≥ 2010): qualifies", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2010, "M", 2010, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2010, "M", 2010, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U16", genderCategory: "OPEN", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeDefined();
    });

    it("U16: born 2009 (age 16) → excluded", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2009, "M", 2010, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2009, "M", 2009, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U16", genderCategory: "OPEN", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });

  describe("gender filter", () => {
    it("GIRLS category: M+F team excluded", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r = mkResult(helmId, 1, 2007, "M", 2007, "F");
        return mkRegatta("2025-06-01", [r, mkResult(uid(), 2, 2007, "F", 2007, "F")]);
      });
      const { rankings } = calculateIdjmQuali({ ageCategory: "U19", genderCategory: "GIRLS", regattas: regs });
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });

  describe("IDJM_MIN_R constant", () => {
    it("IDJM_MIN_R is 25", () => {
      expect(IDJM_MIN_R).toBe(25);
    });
  });
});
