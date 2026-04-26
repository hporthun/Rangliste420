import { describe, it, expect } from "vitest";
import { calculateMultiplier } from "../multiplier";

describe("calculateMultiplier", () => {
  it("0 races → 0", () => expect(calculateMultiplier(0, false)).toBe(0));
  it("1 race → 1", () => expect(calculateMultiplier(1, false)).toBe(1));
  it("1 race multiDay → 1", () => expect(calculateMultiplier(1, true)).toBe(1));
  it("2 races → 2", () => expect(calculateMultiplier(2, false)).toBe(2));
  it("2 races multiDay → 2", () => expect(calculateMultiplier(2, true)).toBe(2));
  it("3 races → 3", () => expect(calculateMultiplier(3, false)).toBe(3));
  it("3 races multiDay → 3", () => expect(calculateMultiplier(3, true)).toBe(3));
  it("4 races → 4", () => expect(calculateMultiplier(4, false)).toBe(4));
  it("4 races multiDay → 4", () => expect(calculateMultiplier(4, true)).toBe(4));
  it("5 races → 4", () => expect(calculateMultiplier(5, false)).toBe(4));
  it("5 races multiDay → 4", () => expect(calculateMultiplier(5, true)).toBe(4));
  it("6 races standard → 4", () => expect(calculateMultiplier(6, false)).toBe(4));
  it("6 races multiDay → 5", () => expect(calculateMultiplier(6, true)).toBe(5));
  it("7 races standard → 4", () => expect(calculateMultiplier(7, false)).toBe(4));
  it("7 races multiDay → 5", () => expect(calculateMultiplier(7, true)).toBe(5));
  it("10 races standard → 4", () => expect(calculateMultiplier(10, false)).toBe(4));
  it("10 races multiDay → 5", () => expect(calculateMultiplier(10, true)).toBe(5));
});
