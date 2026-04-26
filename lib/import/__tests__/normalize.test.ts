import { describe, it, expect } from "vitest";
import { normalizeName, nameVariants } from "../normalize";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  Max  ")).toBe("max");
  });

  it("converts umlauts", () => {
    expect(normalizeName("Müller")).toBe("mueller");
    expect(normalizeName("Schäfer")).toBe("schaefer");
    expect(normalizeName("Köhler")).toBe("koehler");
    expect(normalizeName("Strüver")).toBe("struever");
    expect(normalizeName("Straße")).toBe("strasse");
  });

  it("removes accents", () => {
    expect(normalizeName("André")).toBe("andre");
    expect(normalizeName("Björn")).toBe("bjoern");
  });

  it("replaces hyphens and underscores with space", () => {
    expect(normalizeName("Schmidt-Hansen")).toBe("schmidt hansen");
    expect(normalizeName("van_der_Berg")).toBe("van der berg");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeName("Max  Moritz")).toBe("max moritz");
  });
});

describe("nameVariants", () => {
  it("produces forward and reversed variant", () => {
    const variants = nameVariants("Max Müller");
    expect(variants).toContain("max mueller");
    expect(variants).toContain("mueller max");
  });

  it("handles comma format", () => {
    const variants = nameVariants("Müller, Max");
    expect(variants).toContain("mueller max");
    expect(variants).toContain("max mueller");
  });

  it("deduplicates single-word names", () => {
    const variants = nameVariants("Max");
    expect(variants).toEqual(["max"]);
  });
});
