import { describe, it, expect } from "vitest";
import { calculateJwmJemQuali } from "../jwm-jem-quali";
import type { JwmJemInput } from "../jwm-jem-quali";
import type { RegattaData, ResultData } from "../dsv";

// ── Test helpers ──────────────────────────────────────────────────────────────

let _id = 0;
function uid() {
  return `id-${++_id}`;
}

function mkSailor(birthYear: number | null = 2007, gender: string | null = "M") {
  return { id: uid(), birthYear, gender };
}

function mkResult(
  helmId: string,
  finalRank: number | null,
  opts: {
    helmBirthYear?: number | null;
    helmGender?: string | null;
    crewBirthYear?: number | null;
    crewGender?: string | null;
  } = {}
): ResultData {
  const helm = {
    id: helmId,
    birthYear: opts.helmBirthYear !== undefined ? opts.helmBirthYear : 2007,
    gender: opts.helmGender !== undefined ? opts.helmGender : "M",
  };
  const crew = mkSailor(
    opts.crewBirthYear !== undefined ? opts.crewBirthYear : 2007,
    opts.crewGender !== undefined ? opts.crewGender : "F"
  );
  return {
    id: uid(),
    teamEntry: { helmId, crewId: crew.id, helm, crew },
    finalRank,
    inStartArea: finalRank === null,
  };
}

function mkRegatta(
  startDate: string,
  results: ResultData[],
  overrides: Partial<RegattaData> = {}
): RegattaData {
  return {
    id: uid(),
    name: "Test-Regatta",
    ranglistenFaktor: 1.0,
    completedRaces: 3,
    multiDayAnnouncement: false,
    startDate: new Date(startDate),
    results,
    ...overrides,
  };
}

function mkInput(overrides: Partial<JwmJemInput> = {}): JwmJemInput {
  return {
    regattas: [],
    ageCategory: "OPEN",
    genderCategory: "OPEN",
    referenceDate: new Date("2025-12-31"),
    germanOnly: false,
    helmNationalities: {},
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("calculateJwmJemQuali", () => {
  describe("basic ranking", () => {
    it("3 regattas, sailor with 2 results → in ranked section", () => {
      const helmId = uid();
      const reg1 = mkRegatta("2025-04-01", [mkResult(helmId, 1), mkResult(uid(), 2), mkResult(uid(), 3)]);
      const reg2 = mkRegatta("2025-05-01", [mkResult(helmId, 2), mkResult(uid(), 1), mkResult(uid(), 3)]);
      const reg3 = mkRegatta("2025-06-01", [mkResult(uid(), 1), mkResult(uid(), 2)]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({ regattas: [reg1, reg2, reg3] })
      );

      const row = ranked.find((r) => r.helmId === helmId);
      expect(row).toBeDefined();
      expect(row!.validCount).toBe(2);
      expect(preliminary.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("sailor with only 1 result → in preliminary section", () => {
      const helmId = uid();
      const reg1 = mkRegatta("2025-04-01", [mkResult(helmId, 1), mkResult(uid(), 2)]);
      const reg2 = mkRegatta("2025-05-01", [mkResult(uid(), 1), mkResult(uid(), 2)]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({ regattas: [reg1, reg2] })
      );

      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      const row = preliminary.find((r) => r.helmId === helmId);
      expect(row).toBeDefined();
      expect(row!.validCount).toBe(1);
    });

    it("sailor with 0 results → excluded entirely", () => {
      const helmId = uid();
      // helmId never appears in any regatta
      const reg1 = mkRegatta("2025-04-01", [mkResult(uid(), 1), mkResult(uid(), 2)]);
      const reg2 = mkRegatta("2025-05-01", [mkResult(uid(), 1), mkResult(uid(), 2)]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({ regattas: [reg1, reg2] })
      );

      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      expect(preliminary.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });

  describe("weighting calculation", () => {
    it("1st at 10-boat regatta vs 1st at 20-boat regatta (max=20) → correct scores", () => {
      const helmId = uid();

      // Regatta A: 10 starters, helmId finishes 1st
      const regA = mkRegatta(
        "2025-04-01",
        [
          mkResult(helmId, 1),
          ...Array.from({ length: 9 }, (_, i) => mkResult(uid(), i + 2)),
        ],
        { name: "Regatta A" }
      );
      // Regatta B: 20 starters, helmId finishes 1st
      const regB = mkRegatta(
        "2025-05-01",
        [
          mkResult(helmId, 1),
          ...Array.from({ length: 19 }, (_, i) => mkResult(uid(), i + 2)),
        ],
        { name: "Regatta B" }
      );

      const { ranked, maxStarters, startersByRegatta } = calculateJwmJemQuali(
        mkInput({ regattas: [regA, regB] })
      );

      // maxStarters = 20
      expect(maxStarters).toBe(20);
      expect(startersByRegatta[regA.id]).toBe(10);
      expect(startersByRegatta[regB.id]).toBe(20);

      const row = ranked.find((r) => r.helmId === helmId)!;
      expect(row).toBeDefined();

      const slotA = row.regattaSlots.find((s) => s.regattaId === regA.id)!;
      const slotB = row.regattaSlots.find((s) => s.regattaId === regB.id)!;

      // weightedScore A = 1 × (20/10) = 2.0
      expect(slotA.weightedScore).toBeCloseTo(2.0, 5);
      // weightedScore B = 1 × (20/20) = 1.0
      expect(slotB.weightedScore).toBeCloseTo(1.0, 5);

      // qualiScore = 2.0 + 1.0 = 3.0 (both are the best 2 since only 2 exist)
      expect(row.qualiScore).toBeCloseTo(3.0, 5);
    });

    it("3 regattas: only 2 best (lowest) weighted scores are summed", () => {
      const helmId = uid();

      // 10 starters each, maxStarters=10 → no rescaling
      // Rank 1 → ws=1, rank 2 → ws=2, rank 5 → ws=5
      const reg1 = mkRegatta("2025-04-01", [
        mkResult(helmId, 1),
        ...Array.from({ length: 9 }, (_, i) => mkResult(uid(), i + 2)),
      ]);
      const reg2 = mkRegatta("2025-05-01", [
        mkResult(helmId, 2),
        ...Array.from({ length: 9 }, (_, i) => mkResult(uid(), i < 1 ? 1 : i + 2)),
      ]);
      const reg3 = mkRegatta("2025-06-01", [
        mkResult(helmId, 5),
        ...Array.from({ length: 9 }, (_, i) => mkResult(uid(), i + 1)),
      ]);

      const { ranked } = calculateJwmJemQuali(mkInput({ regattas: [reg1, reg2, reg3] }));
      const row = ranked.find((r) => r.helmId === helmId)!;
      expect(row).toBeDefined();
      // Best 2: ws=1 (rank 1) + ws=2 (rank 2) = 3
      expect(row.qualiScore).toBeCloseTo(3.0, 5);

      // Slot for reg3 (ws=5) should not be counted
      const slot3 = row.regattaSlots.find((s) => s.regattaId === reg3.id)!;
      expect(slot3.counted).toBe(false);

      const slot1 = row.regattaSlots.find((s) => s.regattaId === reg1.id)!;
      const slot2 = row.regattaSlots.find((s) => s.regattaId === reg2.id)!;
      expect(slot1.counted).toBe(true);
      expect(slot2.counted).toBe(true);
    });
  });

  describe("ranking order and tiebreak", () => {
    it("lower qualiScore ranks higher", () => {
      const helmA = uid();
      const helmB = uid();

      // 10 starters each, maxStarters=10
      const reg1 = mkRegatta("2025-04-01", [
        mkResult(helmA, 1),
        mkResult(helmB, 2),
        ...Array.from({ length: 8 }, (_, i) => mkResult(uid(), i + 3)),
      ]);
      const reg2 = mkRegatta("2025-05-01", [
        mkResult(helmA, 1),
        mkResult(helmB, 3),
        ...Array.from({ length: 8 }, (_, i) => mkResult(uid(), i + 4)),
      ]);

      const { ranked } = calculateJwmJemQuali(mkInput({ regattas: [reg1, reg2] }));

      const rowA = ranked.find((r) => r.helmId === helmA)!;
      const rowB = ranked.find((r) => r.helmId === helmB)!;
      expect(rowA.rank).toBe(1);
      expect(rowB.rank).toBe(2);
      expect(rowA.qualiScore).toBeLessThan(rowB.qualiScore);
    });

    it("tiebreak on qualiScore: lower best single weightedScore wins", () => {
      const helmA = uid();
      const helmB = uid();

      // 10 starters, maxStarters=10
      // helmA: rank 1 + rank 3 → ws=1+3=4
      // helmB: rank 2 + rank 2 → ws=2+2=4
      // Tie on qualiScore=4; helmA has best single=1, helmB has best single=2 → A wins
      const reg1 = mkRegatta("2025-04-01", [
        mkResult(helmA, 1),
        mkResult(helmB, 2),
        mkResult(uid(), 3),
        ...Array.from({ length: 7 }, (_, i) => mkResult(uid(), i + 4)),
      ]);
      const reg2 = mkRegatta("2025-05-01", [
        mkResult(helmA, 3),
        mkResult(helmB, 2),
        mkResult(uid(), 1),
        ...Array.from({ length: 7 }, (_, i) => mkResult(uid(), i + 4)),
      ]);

      const { ranked } = calculateJwmJemQuali(mkInput({ regattas: [reg1, reg2] }));

      const rowA = ranked.find((r) => r.helmId === helmA)!;
      const rowB = ranked.find((r) => r.helmId === helmB)!;
      expect(rowA.qualiScore).toBeCloseTo(rowB.qualiScore, 5);
      expect(rowA.rank).toBe(1);
      expect(rowB.rank).toBe(2);
    });

    it("tiebreak level 2: more regattas participated wins", () => {
      const helmA = uid();
      const helmB = uid();

      // 10 starters, maxStarters=10
      // helmA: rank 1 at all 3 → qualiScore=2 (best 2: 1+1), validCount=3
      // helmB: rank 1 at 2 of 3 → qualiScore=2, validCount=2
      // Same qualiScore and best single → A wins because more regattas
      const reg1 = mkRegatta("2025-04-01", [
        mkResult(helmA, 1),
        mkResult(helmB, 1),
        ...Array.from({ length: 8 }, (_, i) => mkResult(uid(), i + 2)),
      ]);
      const reg2 = mkRegatta("2025-05-01", [
        mkResult(helmA, 1),
        mkResult(helmB, 1),
        ...Array.from({ length: 8 }, (_, i) => mkResult(uid(), i + 2)),
      ]);
      const reg3 = mkRegatta("2025-06-01", [
        mkResult(helmA, 1),
        mkResult(uid(), 2),
        // helmB not in reg3
      ]);

      const { ranked } = calculateJwmJemQuali(mkInput({ regattas: [reg1, reg2, reg3] }));

      const rowA = ranked.find((r) => r.helmId === helmA)!;
      const rowB = ranked.find((r) => r.helmId === helmB)!;
      expect(rowA.qualiScore).toBeCloseTo(rowB.qualiScore, 5);
      expect(rowA.rank).toBe(1); // A has 3 regattas vs B's 2
      expect(rowB.rank).toBe(2);
    });
  });

  describe("nationality filter", () => {
    it("non-German sailor excluded when germanOnly=true", () => {
      const helmId = uid();
      const reg1 = mkRegatta("2025-04-01", [mkResult(helmId, 1), mkResult(uid(), 2)]);
      const reg2 = mkRegatta("2025-05-01", [mkResult(helmId, 1), mkResult(uid(), 2)]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({
          regattas: [reg1, reg2],
          germanOnly: true,
          helmNationalities: { [helmId]: "DEN" },
        })
      );

      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      expect(preliminary.find((r) => r.helmId === helmId)).toBeUndefined();
    });

    it("German sailor included when germanOnly=true", () => {
      const helmId = uid();
      const reg1 = mkRegatta("2025-04-01", [mkResult(helmId, 1), mkResult(uid(), 2)]);
      const reg2 = mkRegatta("2025-05-01", [mkResult(helmId, 1), mkResult(uid(), 2)]);

      const { ranked } = calculateJwmJemQuali(
        mkInput({
          regattas: [reg1, reg2],
          germanOnly: true,
          helmNationalities: { [helmId]: "GER" },
        })
      );

      expect(ranked.find((r) => r.helmId === helmId)).toBeDefined();
    });
  });

  describe("age filter per-regatta", () => {
    it("sailor too old at one regatta → that slot not counted", () => {
      const helmId = uid();
      // U16 = max age 15, refYear from regatta.startDate
      // reg1 at 2025-06-01 → refYear=2025. helmBirthYear=2010 → age=15 (ok for U16)
      // reg2 at 2026-01-01 → refYear=2026. helmBirthYear=2010 → age=16 (too old for U16)
      const reg1 = mkRegatta("2025-06-01", [
        mkResult(helmId, 1, { helmBirthYear: 2010, helmGender: "M", crewBirthYear: 2010, crewGender: "F" }),
        mkResult(uid(), 2, { helmBirthYear: 2010, helmGender: "M", crewBirthYear: 2010, crewGender: "F" }),
      ]);
      const reg2 = mkRegatta("2026-01-01", [
        mkResult(helmId, 1, { helmBirthYear: 2010, helmGender: "M", crewBirthYear: 2010, crewGender: "F" }),
        mkResult(uid(), 2, { helmBirthYear: 2010, helmGender: "M", crewBirthYear: 2010, crewGender: "F" }),
      ]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({
          regattas: [reg1, reg2],
          ageCategory: "U16",
          referenceDate: new Date("2025-12-31"),
        })
      );

      // Only reg1 slot is valid → preliminary
      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      const row = preliminary.find((r) => r.helmId === helmId)!;
      expect(row).toBeDefined();
      expect(row.validCount).toBe(1);

      const slot1 = row.regattaSlots.find((s) => s.regattaId === reg1.id)!;
      const slot2 = row.regattaSlots.find((s) => s.regattaId === reg2.id)!;
      expect(slot1.weightedScore).not.toBeNull();
      expect(slot2.weightedScore).toBeNull();
    });

    it("gender filter: female-only team excluded from MEN category", () => {
      const helmId = uid();
      const reg1 = mkRegatta("2025-04-01", [
        mkResult(helmId, 1, { helmGender: "F", crewGender: "F" }),
        mkResult(uid(), 2),
      ]);
      const reg2 = mkRegatta("2025-05-01", [
        mkResult(helmId, 1, { helmGender: "F", crewGender: "F" }),
        mkResult(uid(), 2),
      ]);

      const { ranked, preliminary } = calculateJwmJemQuali(
        mkInput({ regattas: [reg1, reg2], genderCategory: "MEN" })
      );

      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      expect(preliminary.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("empty regattas → empty output", () => {
      const { ranked, preliminary, maxStarters } = calculateJwmJemQuali(mkInput({ regattas: [] }));
      expect(ranked).toHaveLength(0);
      expect(preliminary).toHaveLength(0);
      expect(maxStarters).toBe(0);
    });

    it("result with null finalRank counts as 0 starters for that regatta slot", () => {
      const helmId = uid();
      // helmId is in the regatta but has no finalRank → slot should have null weightedScore
      const result: ResultData = {
        id: uid(),
        teamEntry: {
          helmId,
          crewId: uid(),
          helm: { id: helmId, birthYear: 2007, gender: "M" },
          crew: { id: uid(), birthYear: 2007, gender: "F" },
        },
        finalRank: null,
        inStartArea: true,
      };
      const other = mkResult(uid(), 1);
      const reg = mkRegatta("2025-04-01", [result, other]);

      const { ranked, preliminary } = calculateJwmJemQuali(mkInput({ regattas: [reg] }));

      // helmId slot has weightedScore=null (no finalRank) → validCount=0 → excluded
      expect(ranked.find((r) => r.helmId === helmId)).toBeUndefined();
      expect(preliminary.find((r) => r.helmId === helmId)).toBeUndefined();
    });
  });
});
