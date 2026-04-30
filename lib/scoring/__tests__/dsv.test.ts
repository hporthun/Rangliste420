import { describe, it, expect } from "vitest";
import { calculateRA, calculateDsvRanking } from "../dsv";
import type { RegattaData, ResultData, DsvRankingInput } from "../dsv";

// ── calculateRA ───────────────────────────────────────────────────────────────

describe("calculateRA", () => {
  it("Kieler Woche example: f=2.60, s=80, x=10 → 230.75", () => {
    expect(calculateRA({ f: 2.6, s: 80, x: 10 })).toBeCloseTo(230.75, 5);
  });

  it("f=0.80, s=10, x=1 → 80", () => {
    expect(calculateRA({ f: 0.8, s: 10, x: 1 })).toBeCloseTo(80, 5);
  });

  it("f=2.60, s=10, x=1 → 260", () => {
    expect(calculateRA({ f: 2.6, s: 10, x: 1 })).toBeCloseTo(260, 5);
  });

  it("last place (x=s): f=1.0, s=5, x=5 → 20", () => {
    expect(calculateRA({ f: 1.0, s: 5, x: 5 })).toBeCloseTo(20, 5);
  });

  it("single starter (s=1, x=1): R_A = 100 × f", () => {
    expect(calculateRA({ f: 1.0, s: 1, x: 1 })).toBeCloseTo(100, 5);
    expect(calculateRA({ f: 2.6, s: 1, x: 1 })).toBeCloseTo(260, 5);
  });

  it("f=0.80, s=1, x=1 → 80", () => {
    expect(calculateRA({ f: 0.8, s: 1, x: 1 })).toBeCloseTo(80, 5);
  });
});

// ── Test helpers ──────────────────────────────────────────────────────────────

let _id = 0;
function uid() { return `id-${++_id}`; }


function mkResult(
  helmId: string,
  finalRank: number | null,
  inStartArea = false,
  helmBirth = 2007,
  helmGender = "M",
  crewBirth = 2007,
  crewGender = "F"
): ResultData {
  const helm = { id: helmId, birthYear: helmBirth, gender: helmGender };
  const crew = { id: uid(), birthYear: crewBirth, gender: crewGender };
  return {
    id: uid(),
    teamEntry: { helmId, crewId: crew.id, helm, crew },
    finalRank,
    inStartArea,
  };
}

function mkRegatta(
  completedRaces: number,
  multiDay: boolean,
  results: ResultData[],
  f = 1.0
): RegattaData {
  return {
    id: uid(),
    name: "Test-Regatta",
    ranglistenFaktor: f,
    completedRaces,
    multiDayAnnouncement: multiDay,
    startDate: new Date("2025-06-01"),
    results,
  };
}

function mkInput(regattas: RegattaData[], overrides: Partial<DsvRankingInput> = {}): DsvRankingInput {
  return {
    seasonYear: 2025,
    ageCategory: "OPEN",
    genderCategory: "OPEN",
    referenceDate: new Date(2025, 11, 31),
    regattas,
    ...overrides,
  };
}

/**
 * Builds n single-race regattas where helmId wins rank 1 out of s starters, f=fVal.
 * Each regatta has s results total (1 helm + s-1 fillers).
 */
function buildRegattas(helmId: string, count: number, s: number, f: number): RegattaData[] {
  return Array.from({ length: count }, () => {
    const results: ResultData[] = [mkResult(helmId, 1)];
    for (let i = 1; i < s; i++) results.push(mkResult(uid(), i + 1));
    return mkRegatta(1, false, results, f);
  });
}

// ── calculateDsvRanking ───────────────────────────────────────────────────────

describe("calculateDsvRanking", () => {
  describe("basic formula", () => {
    it("9 identical regattas (f=1, s=10, x=1) → R=100", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 9, 10, 1.0);
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      expect(e.R).toBeCloseTo(100, 5);
      expect(e.rank).toBe(1);
    });
  });

  // User-Wunsch 2026-04-29: Auslandsregatten haben oft Crews, die nicht
  // importiert werden. Damit s in der R_A-Formel trotzdem stimmt, kann an
  // der Regatta ein expliziter `totalStarters`-Wert gepflegt werden.
  describe("totalStarters override (Auslandsregatten)", () => {
    it("nutzt totalStarters statt results.length wenn gesetzt", () => {
      const helmId = uid();
      // 9 Regatten, je 10 importierte Boote, helmId auf Platz 5.
      // Ohne totalStarters: s=10 → R_A = 1*100*(10+1-5)/10 = 60 → R=60
      // Mit totalStarters=20 (z.B. Auslandsregatta): s=20 → R_A = 1*100*(21-5)/20 = 80 → R=80
      const regattas: RegattaData[] = Array.from({ length: 9 }, () => {
        const results: ResultData[] = [
          mkResult(uid(), 1),
          mkResult(uid(), 2),
          mkResult(uid(), 3),
          mkResult(uid(), 4),
          mkResult(helmId, 5),
          mkResult(uid(), 6),
          mkResult(uid(), 7),
          mkResult(uid(), 8),
          mkResult(uid(), 9),
          mkResult(uid(), 10),
        ];
        return { ...mkRegatta(1, false, results, 1.0), totalStarters: 20 };
      });

      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      // s sollte 20 sein in jedem RankingValue (überschrieben)
      expect(e.top9[0].s).toBe(20);
      expect(e.R).toBeCloseTo(80, 5);
    });

    it("fällt auf results.length zurück wenn totalStarters undefined", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 9, 10, 1.0);
      // Kein totalStarters gesetzt → fallback
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e.top9[0].s).toBe(10); // = results.length
    });

    it("fällt auf results.length zurück wenn totalStarters explizit null", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 9, 10, 1.0).map((r) => ({
        ...r,
        totalStarters: null,
      }));
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e.top9[0].s).toBe(10);
    });

    it("totalStarters kleiner als results.length wirkt trotzdem (auch wenn unsinnig)", () => {
      // Defensiv: Wir vertrauen dem Admin-Wert. Falls jemand totalStarters
      // unter results.length setzt, wird es trotzdem verwendet — ist
      // semantisch fragwürdig, aber kein Grund die Formel zu ändern.
      const helmId = uid();
      const regattas: RegattaData[] = Array.from({ length: 9 }, () => {
        const results: ResultData[] = [mkResult(helmId, 1)];
        for (let i = 1; i < 10; i++) results.push(mkResult(uid(), i + 1));
        return { ...mkRegatta(1, false, results, 1.0), totalStarters: 5 };
      });
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e.top9[0].s).toBe(5);
    });
  });

  describe("minimum values requirement", () => {
    it("8 values → not in rankings", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 8, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("exactly 9 values → listed", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 9, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      expect(rankings.find((r) => r.helmId === helmId)).toBeDefined();
    });

    it(">9 values → still listed", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 15, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput(regattas));
      expect(rankings.find((r) => r.helmId === helmId)).toBeDefined();
    });
  });

  describe("multiplier m", () => {
    it("m=3 (3-race regatta): one regatta generates 3 values", () => {
      const helmId = uid();
      // 3-race regatta → m=3, so 3 values per helm
      // Need 9 total: 3 + 6 single-race regattas
      const mainReg = mkRegatta(3, false, [mkResult(helmId, 1), mkResult(uid(), 2), mkResult(uid(), 3)]);
      const extras = buildRegattas(helmId, 6, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput([mainReg, ...extras]));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      // 3 + 6 = 9 total values
      expect(e.allValues.length).toBe(9);
    });

    it("m=5 (6-race multiDay): one regatta generates 5 values", () => {
      const helmId = uid();
      const fillers = Array.from({ length: 10 }, (_, i) => mkResult(uid(), i + 2));
      const mainReg = mkRegatta(6, true, [mkResult(helmId, 1), ...fillers]);
      const extras = buildRegattas(helmId, 4, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput([mainReg, ...extras]));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      expect(e.allValues.length).toBe(9); // 5 + 4
    });

    it("m=4 (4-race regatta, standard): 4 values", () => {
      const helmId = uid();
      const mainReg = mkRegatta(4, false, [mkResult(helmId, 1), mkResult(uid(), 2)]);
      const extras = buildRegattas(helmId, 5, 2, 1.0);
      const { rankings } = calculateDsvRanking(mkInput([mainReg, ...extras]));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      expect(e.allValues.length).toBe(9); // 4 + 5
    });
  });

  describe("inStartArea: R_A = 0, still counts in s", () => {
    it("8 wins + 1 start-area entry → R = 800/9 ≈ 88.89", () => {
      const helmId = uid();
      const regattas = buildRegattas(helmId, 8, 2, 1.0);
      // 9th regatta: helmId in start area, no rank. s=2 (1 finisher + 1 start)
      const startReg = mkRegatta(1, false, [
        { ...mkResult(helmId, null, true), teamEntry: { ...mkResult(helmId, null, true).teamEntry, helmId } },
        mkResult(uid(), 1),
      ]);
      // Ensure helmId is correct in the start entry
      startReg.results[0].teamEntry.helmId = helmId;
      startReg.results[0].teamEntry.helm.id = helmId;
      regattas.push(startReg);

      const { rankings } = calculateDsvRanking(mkInput(regattas));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      expect(e.R).toBeCloseTo(800 / 9, 4);
      const startVal = e.top9.find((v) => v.inStartArea);
      expect(startVal).toBeDefined();
      expect(startVal!.value).toBe(0);
    });
  });

  describe("9-best selection", () => {
    it("12 results: picks best 9, drops worst 3", () => {
      const helmId = uid();
      // s=20, f=1.0; ranks 1-12 give R_A = 100*(21-x)/20
      const regs: RegattaData[] = [];
      for (let x = 1; x <= 12; x++) {
        const fillers: ResultData[] = [];
        for (let j = 0; j < 19; j++) fillers.push(mkResult(uid(), j < x - 1 ? j + 1 : j + 2));
        regs.push(mkRegatta(1, false, [mkResult(helmId, x), ...fillers], 1.0));
        // Ensure each has 20 results (helm + 19 fillers)
        regs[regs.length - 1].results = [mkResult(helmId, x), ...Array.from({ length: 19 }, (_, j) => mkResult(uid(), j + 2))];
      }
      // Fix helmId in each regatta
      regs.forEach((reg) => {
        reg.results[0].teamEntry.helmId = helmId;
        reg.results[0].teamEntry.helm.id = helmId;
      });

      const { rankings } = calculateDsvRanking(mkInput(regs));
      const e = rankings.find((r) => r.helmId === helmId)!;
      expect(e).toBeDefined();
      expect(e.top9.length).toBe(9);
      // Best 9 are x=1..9; worst are x=10,11,12
      const top9Ranks = e.top9.map((v) => v.x).sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(top9Ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const expectedR = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((x) => 100 * (21 - x) / 20)
        .reduce((sum, v) => sum + v, 0) / 9;
      expect(e.R).toBeCloseTo(expectedR, 5);
    });
  });

  describe("tiebreak", () => {
    it("equal R → higher best single R_A wins (tiebreak level 1)", () => {
      // Helm A: 1 × R_A=110 + 8 × R_A=98.75 → avg = (110 + 790)/9 = 100
      // Helm B: 9 × R_A=100 → avg = 100
      // Same R=100; A wins because best single (110) > B best (100)
      const helmA = uid();
      const helmB = uid();

      // f=1.1, s=10, x=1 → R_A=110
      const regA1 = mkRegatta(1, false, [mkResult(helmA, 1), ...Array.from({ length: 9 }, () => mkResult(uid(), 2))], 1.1);
      regA1.results[0].teamEntry.helmId = helmA;
      regA1.results[0].teamEntry.helm.id = helmA;

      // f=0.9875, s=10, x=1 → R_A=98.75
      const regsA2 = Array.from({ length: 8 }, () => {
        const reg = mkRegatta(1, false, [mkResult(helmA, 1), ...Array.from({ length: 9 }, () => mkResult(uid(), 2))], 0.9875);
        reg.results[0].teamEntry.helmId = helmA;
        reg.results[0].teamEntry.helm.id = helmA;
        return reg;
      });

      // f=1.0, s=10, x=1 → R_A=100
      const regsB = Array.from({ length: 9 }, () => {
        const reg = mkRegatta(1, false, [mkResult(helmB, 1), ...Array.from({ length: 9 }, () => mkResult(uid(), 2))], 1.0);
        reg.results[0].teamEntry.helmId = helmB;
        reg.results[0].teamEntry.helm.id = helmB;
        return reg;
      });

      const { rankings } = calculateDsvRanking(mkInput([regA1, ...regsA2, ...regsB]));
      const a = rankings.find((r) => r.helmId === helmA)!;
      const b = rankings.find((r) => r.helmId === helmB)!;
      expect(a.R).toBeCloseTo(100, 4);
      expect(b.R).toBeCloseTo(100, 4);
      expect(a.rank).toBe(1);
      expect(b.rank).toBe(2);
    });

    it("equal R and best single → more total values wins (tiebreak level 2)", () => {
      // Helm A: 11 wins, all R_A=100 → top9=100, allValues=11
      // Helm B: 9 wins, all R_A=100 → top9=100, allValues=9
      const helmA = uid();
      const helmB = uid();

      const regsA = Array.from({ length: 11 }, () => {
        const reg = mkRegatta(1, false, [mkResult(helmA, 1), mkResult(uid(), 2)], 1.0);
        reg.results[0].teamEntry.helmId = helmA;
        reg.results[0].teamEntry.helm.id = helmA;
        return reg;
      });
      const regsB = Array.from({ length: 9 }, () => {
        const reg = mkRegatta(1, false, [mkResult(helmB, 1), mkResult(uid(), 2)], 1.0);
        reg.results[0].teamEntry.helmId = helmB;
        reg.results[0].teamEntry.helm.id = helmB;
        return reg;
      });

      const { rankings } = calculateDsvRanking(mkInput([...regsA, ...regsB]));
      const a = rankings.find((r) => r.helmId === helmA)!;
      const b = rankings.find((r) => r.helmId === helmB)!;
      expect(a.R).toBeCloseTo(b.R, 4);
      expect(a.rank).toBe(1);
      expect(b.rank).toBe(2);
    });
  });

  describe("age and gender filtering", () => {
    it("U19: helm with null birthYear → excluded", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r: ResultData = {
          id: uid(),
          teamEntry: {
            helmId,
            crewId: uid(),
            helm: { id: helmId, birthYear: null, gender: "M" },
            crew: { id: uid(), birthYear: 2007, gender: "F" },
          },
          finalRank: 1,
          inStartArea: false,
        };
        return mkRegatta(1, false, [r, mkResult(uid(), 2)]);
      });
      const { rankings } = calculateDsvRanking(
        mkInput(regs, { ageCategory: "U19", referenceDate: new Date(2025, 11, 31) })
      );
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("GIRLS: M+F team excluded", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r: ResultData = {
          id: uid(),
          teamEntry: {
            helmId,
            crewId: uid(),
            helm: { id: helmId, birthYear: 2007, gender: "M" },
            crew: { id: uid(), birthYear: 2007, gender: "F" },
          },
          finalRank: 1,
          inStartArea: false,
        };
        return mkRegatta(1, false, [r, mkResult(uid(), 2)]);
      });
      const { rankings } = calculateDsvRanking(mkInput(regs, { genderCategory: "GIRLS" }));
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("MEN: M+M team included", () => {
      const helmId = uid();
      const regs: RegattaData[] = Array.from({ length: 9 }, () => {
        const r: ResultData = {
          id: uid(),
          teamEntry: {
            helmId,
            crewId: uid(),
            helm: { id: helmId, birthYear: 2007, gender: "M" },
            crew: { id: uid(), birthYear: 2007, gender: "M" },
          },
          finalRank: 1,
          inStartArea: false,
        };
        return mkRegatta(1, false, [r, mkResult(uid(), 2)]);
      });
      const { rankings } = calculateDsvRanking(mkInput(regs, { genderCategory: "MEN" }));
      expect(rankings.find((r) => r.helmId === helmId)).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("empty regattas → empty rankings", () => {
      expect(calculateDsvRanking(mkInput([])).rankings).toHaveLength(0);
    });

    it("regatta with no results → empty rankings", () => {
      expect(calculateDsvRanking(mkInput([mkRegatta(3, false, [])])).rankings).toHaveLength(0);
    });

    it("regatta with 0 completed races → 0 values (m=0)", () => {
      const helmId = uid();
      const reg = mkRegatta(0, false, [mkResult(helmId, 1), mkResult(uid(), 2)]);
      const { rankings } = calculateDsvRanking(mkInput([reg]));
      expect(rankings.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });
});
