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
    name: "Test-Regatta",
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

  // User-Klarstellung 2026-04-29: Für die normalen Ranglisten (inkl. IDJM)
  // wird die GESAMTteilnehmerzahl der Regatta für s benutzt — auch
  // ausländische Boote und auch Boote, die durch den Altersfilter rausfallen.
  describe("Gesamtteilnehmerzahl s — ungefiltert", () => {
    it("ausländische / zu alte Boote zählen weiterhin in s", () => {
      // Setup: 1 berechtigter Helm + 99 zu alte/außerhalb-Filter Boote.
      // Wenn s richtig ist, ist s=100 → R_A = f * 100 * (101-x)/100.
      // Wenn s fälschlich gefiltert wird, wäre s=1 → R_A = f * 100 * (1+1-1)/1 = 100.
      // Wir prüfen den Wert für x=1 → soll R_A = 100 sein (100 Boote, Platz 1).
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        // berechtigter Helm: Platz 1, Helm 2007, Crew 2007 (U19 ok)
        const winner = mkResult(helmId, 1, 2007, "M", 2007, "F");
        // 99 zu alte Boote (Helm 2000) belegen Plätze 2..100
        const fillers = Array.from({ length: 99 }, (_, i) =>
          mkResult(uid(), i + 2, 2000, "M", 2000, "F")
        );
        return mkRegatta("2025-06-01", [winner, ...fillers]);
      });

      const { rankings } = calculateIdjmQuali({
        ageCategory: "U19",
        genderCategory: "OPEN",
        regattas: regs,
      });

      const entry = rankings.find((r) => r.helmId === helmId);
      expect(entry).toBeDefined();
      // f=1, s=100, x=1 → R_A = 100 * (100+1-1)/100 = 100
      // Wenn s fälschlich gefiltert worden wäre (nur 1 Boot), wäre R_A
      // weiterhin = 100 (1+1-1)/1 = 100 — schlechter Testfall. Nehmen
      // wir x=2 stattdessen — vorher als zweiter Helm
      // Stattdessen: prüfen wir s direkt aus den allValues
      const value = entry!.allValues[0];
      expect(value.s).toBe(100);
      expect(value.x).toBe(1);
      // R_A = 1 * 100 * (101-1)/100 = 100
      expect(value.value).toBeCloseTo(100, 5);
    });

    it("Helm auf Platz 50 von 100 Booten: R_A wird mit s=100 berechnet", () => {
      // Konkreter Auslandsregatta-Fall: 100 Boote in der Regatta, die
      // Hälfte davon ist außerhalb der Quali-Altersgrenze. Trotzdem
      // muss s=100 sein.
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const me = mkResult(helmId, 50, 2007, "M", 2007, "F");
        // 49 jüngere Boote auf Plätzen 1..49
        const youngerThanMe = Array.from({ length: 49 }, (_, i) =>
          mkResult(uid(), i + 1, 2007, "M", 2007, "F")
        );
        // 50 zu alte Boote auf Plätzen 51..100
        const olderBehindMe = Array.from({ length: 50 }, (_, i) =>
          mkResult(uid(), i + 51, 2000, "M", 2000, "F")
        );
        return mkRegatta("2025-06-01", [me, ...youngerThanMe, ...olderBehindMe]);
      });
      const { rankings } = calculateIdjmQuali({
        ageCategory: "U19",
        genderCategory: "OPEN",
        regattas: regs,
      });
      const entry = rankings.find((r) => r.helmId === helmId);
      expect(entry).toBeDefined();
      const v = entry!.allValues[0];
      expect(v.s).toBe(100);
      expect(v.x).toBe(50);
      // R_A = 1 * 100 * (101-50)/100 = 51
      expect(v.value).toBeCloseTo(51, 5);
    });
  });
});
