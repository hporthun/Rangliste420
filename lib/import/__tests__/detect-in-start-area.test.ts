import { describe, it, expect } from "vitest";
import { detectInStartArea, IN_START_AREA_CODES } from "../pdf-utils";
import type { ParsedRaceScore } from "../manage2sail-paste";

// Single source of truth fuer "Boot kam ins Startgebiet"-Heuristik
// (Issue #60). Liste muss synchron zu docs/business-rules.md §2.1 sein.

function score(code?: string): ParsedRaceScore {
  return { race: 1, points: 0, code, isDiscard: false };
}

describe("IN_START_AREA_CODES (single source of truth)", () => {
  it("enthaelt genau die vier dokumentierten Codes", () => {
    expect([...IN_START_AREA_CODES].sort()).toEqual(
      ["BFD", "DNS", "OCS", "UFD"].sort(),
    );
  });
});

describe("detectInStartArea", () => {
  describe("trifft auf den dokumentierten Codes", () => {
    it("DNS → true", () => expect(detectInStartArea([score("DNS")])).toBe(true));
    it("OCS → true", () => expect(detectInStartArea([score("OCS")])).toBe(true));
    it("BFD → true", () => expect(detectInStartArea([score("BFD")])).toBe(true));
    it("UFD → true", () => expect(detectInStartArea([score("UFD")])).toBe(true));
  });

  describe("trifft NICHT auf restliche Penalty-Codes", () => {
    it("DNC (gar nicht erschienen) → false", () =>
      expect(detectInStartArea([score("DNC")])).toBe(false));
    it("DNF (gestartet, nicht ins Ziel) → false", () =>
      expect(detectInStartArea([score("DNF")])).toBe(false));
    it("DSQ (gestartet, dann disqualifiziert) → false", () =>
      expect(detectInStartArea([score("DSQ")])).toBe(false));
    it("RET (zurueckgezogen) → false", () =>
      expect(detectInStartArea([score("RET")])).toBe(false));
    it("WFD → false", () =>
      expect(detectInStartArea([score("WFD")])).toBe(false));
  });

  describe("Edge-Cases", () => {
    it("leere Liste → false", () => expect(detectInStartArea([])).toBe(false));
    it("kein Code (regulaeres Ergebnis) → false", () =>
      expect(detectInStartArea([score(undefined)])).toBe(false));
    it("Mischung mit einem Treffer → true", () =>
      expect(detectInStartArea([score(undefined), score("UFD"), score("DNF")])).toBe(true));
    it("Codes case-insensitiv (kleinschreibung haeufig in PDFs)", () =>
      expect(detectInStartArea([score("ufd")])).toBe(true));
  });
});
