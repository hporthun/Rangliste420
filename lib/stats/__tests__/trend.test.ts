import { describe, it, expect } from "vitest";
import { linearTrend, trendLine } from "../trend";

describe("linearTrend", () => {
  it("perfekt linearer Aufstieg → slope > 0, r2 = 1", () => {
    const r = linearTrend({ values: [10, 20, 30, 40] });
    expect(r.slope).toBeCloseTo(10, 10);
    expect(r.intercept).toBeCloseTo(10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
    expect(r.n).toBe(4);
  });

  it("perfekt linearer Abstieg → slope < 0, r2 = 1", () => {
    const r = linearTrend({ values: [40, 30, 20, 10] });
    expect(r.slope).toBeCloseTo(-10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it("konstante Werte → slope = 0, r2 = 1 (perfekt erklärte Null-Varianz)", () => {
    const r = linearTrend({ values: [50, 50, 50, 50] });
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(50);
    expect(r.r2).toBe(1);
  });

  it("verrauschte aber steigende Daten → slope > 0, r2 zwischen 0 und 1", () => {
    const r = linearTrend({ values: [10, 25, 20, 35, 30, 50] });
    expect(r.slope).toBeGreaterThan(0);
    expect(r.r2).toBeGreaterThan(0.5);
    expect(r.r2).toBeLessThan(1);
  });

  it("zufällig schwankende Daten → r2 nahe 0", () => {
    // Symmetrisch um den Mittelwert, kein klarer Trend
    const r = linearTrend({ values: [50, 50, 50, 50, 50] });
    expect(Math.abs(r.slope)).toBeLessThan(1e-9);
  });

  it("n=1 → slope=0, intercept=value, r2=0", () => {
    const r = linearTrend({ values: [42] });
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(42);
    expect(r.r2).toBe(0);
    expect(r.n).toBe(1);
  });

  it("n=0 → alles 0", () => {
    const r = linearTrend({ values: [] });
    expect(r).toEqual({ slope: 0, intercept: 0, r2: 0, n: 0 });
  });

  it("n=2 → exakte Gerade durch beide Punkte, r2=1", () => {
    const r = linearTrend({ values: [10, 30] });
    expect(r.slope).toBe(20);
    expect(r.intercept).toBe(10);
    expect(r.r2).toBe(1);
  });
});

describe("trendLine", () => {
  it("liefert y-Werte entlang intercept + slope * i", () => {
    expect(trendLine(10, 5, 4)).toEqual([10, 15, 20, 25]);
  });

  it("n=0 → leeres Array", () => {
    expect(trendLine(10, 5, 0)).toEqual([]);
  });

  it("rekonstruiert die Originalpunkte bei perfekt linearem Input", () => {
    const original = [10, 20, 30, 40];
    const { slope, intercept, n } = linearTrend({ values: original });
    const line = trendLine(intercept, slope, n);
    line.forEach((v, i) => expect(v).toBeCloseTo(original[i]!, 10));
  });
});
