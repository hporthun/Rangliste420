import { describe, it, expect } from "vitest";
import { matchesAgeCategory, matchesGenderCategory } from "../filters";

// Reference date: Dec 31, 2025 (Jahresrangliste season 2025)
const REF = new Date(2025, 11, 31);

function mkEntry(
  helmBirth: number | null,
  helmGender: string | null,
  crewBirth: number | null,
  crewGender: string | null
) {
  return {
    helm: { birthYear: helmBirth, gender: helmGender },
    crew: { birthYear: crewBirth, gender: crewGender },
  };
}

// ── Age category ──────────────────────────────────────────────────────────────

describe("matchesAgeCategory", () => {
  describe("OPEN", () => {
    it("always true regardless of birth years", () => {
      expect(matchesAgeCategory(mkEntry(null, null, null, null), "OPEN", REF)).toBe(true);
      expect(matchesAgeCategory(mkEntry(1980, "M", 1980, "F"), "OPEN", REF)).toBe(true);
    });
  });

  describe("U19 (max 18, refYear=2025 → birthYear >= 2007)", () => {
    it("both born 2007 → match (2025-2007=18)", () => {
      expect(matchesAgeCategory(mkEntry(2007, "M", 2007, "F"), "U19", REF)).toBe(true);
    });

    it("one born 2006 → no match (2025-2006=19)", () => {
      expect(matchesAgeCategory(mkEntry(2006, "M", 2007, "F"), "U19", REF)).toBe(false);
    });

    it("crew born 2006 → no match", () => {
      expect(matchesAgeCategory(mkEntry(2007, "M", 2006, "F"), "U19", REF)).toBe(false);
    });
  });

  describe("U17 (max 16, refYear=2025 → birthYear >= 2009)", () => {
    it("both born 2009 → match", () => {
      expect(matchesAgeCategory(mkEntry(2009, "M", 2009, "F"), "U17", REF)).toBe(true);
    });

    it("one born 2008 → no match", () => {
      expect(matchesAgeCategory(mkEntry(2008, "M", 2009, "F"), "U17", REF)).toBe(false);
    });
  });

  describe("U16 (max 15, refYear=2025 → birthYear >= 2010)", () => {
    it("both born 2010 → match", () => {
      expect(matchesAgeCategory(mkEntry(2010, "M", 2010, "F"), "U16", REF)).toBe(true);
    });

    it("one born 2009 → no match", () => {
      expect(matchesAgeCategory(mkEntry(2009, "M", 2010, "F"), "U16", REF)).toBe(false);
    });
  });

  describe("U15 (max 14, refYear=2025 → birthYear >= 2011)", () => {
    it("both born 2011 → match", () => {
      expect(matchesAgeCategory(mkEntry(2011, "M", 2011, "F"), "U15", REF)).toBe(true);
    });

    it("one born 2010 → no match", () => {
      expect(matchesAgeCategory(mkEntry(2010, "M", 2011, "F"), "U15", REF)).toBe(false);
    });
  });

  describe("missing birth years", () => {
    it("missing helm birthYear → false for U19", () => {
      expect(matchesAgeCategory(mkEntry(null, "M", 2007, "F"), "U19", REF)).toBe(false);
    });

    it("missing crew birthYear → false for U19", () => {
      expect(matchesAgeCategory(mkEntry(2007, "M", null, "F"), "U19", REF)).toBe(false);
    });

    it("missing both → false for U19", () => {
      expect(matchesAgeCategory(mkEntry(null, null, null, null), "U19", REF)).toBe(false);
    });

    it("missing birthYear → still true for OPEN", () => {
      expect(matchesAgeCategory(mkEntry(null, null, null, null), "OPEN", REF)).toBe(true);
    });
  });

  describe("no crew (PDF import)", () => {
    it("null crew → false for U19", () => {
      expect(
        matchesAgeCategory({ helm: { birthYear: 2007, gender: "M" }, crew: null }, "U19", REF)
      ).toBe(false);
    });

    it("null crew → true for OPEN", () => {
      expect(
        matchesAgeCategory({ helm: { birthYear: 2007, gender: "M" }, crew: null }, "OPEN", REF)
      ).toBe(true);
    });
  });
});

// ── Gender category ───────────────────────────────────────────────────────────

describe("matchesGenderCategory", () => {
  describe("OPEN", () => {
    it("always true", () => {
      expect(matchesGenderCategory({ helm: { birthYear: null, gender: null }, crew: null }, "OPEN")).toBe(true);
      expect(matchesGenderCategory(mkEntry(null, "M", null, "M"), "OPEN")).toBe(true);
    });
  });

  describe("MEN (M + M)", () => {
    it("M + M → true", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "M"), "MEN")).toBe(true));
    it("M + F → false", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "F"), "MEN")).toBe(false));
    it("F + F → false", () => expect(matchesGenderCategory(mkEntry(null, "F", null, "F"), "MEN")).toBe(false));
  });

  describe("GIRLS (F + F)", () => {
    it("F + F → true", () => expect(matchesGenderCategory(mkEntry(null, "F", null, "F"), "GIRLS")).toBe(true));
    it("M + F → false", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "F"), "GIRLS")).toBe(false));
    it("M + M → false", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "M"), "GIRLS")).toBe(false));
  });

  describe("MIX (M+F or F+M)", () => {
    it("M + F → true", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "F"), "MIX")).toBe(true));
    it("F + M → true", () => expect(matchesGenderCategory(mkEntry(null, "F", null, "M"), "MIX")).toBe(true));
    it("M + M → false", () => expect(matchesGenderCategory(mkEntry(null, "M", null, "M"), "MIX")).toBe(false));
    it("F + F → false", () => expect(matchesGenderCategory(mkEntry(null, "F", null, "F"), "MIX")).toBe(false));
  });

  describe("missing gender", () => {
    it("missing helm gender → false for MEN", () => {
      expect(matchesGenderCategory(mkEntry(null, null, null, "M"), "MEN")).toBe(false);
    });

    it("missing crew gender → false for GIRLS", () => {
      expect(matchesGenderCategory(mkEntry(null, "F", null, null), "GIRLS")).toBe(false);
    });

    it("missing gender → true for OPEN", () => {
      expect(matchesGenderCategory(mkEntry(null, null, null, null), "OPEN")).toBe(true);
    });
  });

  describe("no crew (PDF import)", () => {
    it("null crew → false for MEN", () => {
      expect(
        matchesGenderCategory({ helm: { birthYear: null, gender: "M" }, crew: null }, "MEN")
      ).toBe(false);
    });
  });
});
