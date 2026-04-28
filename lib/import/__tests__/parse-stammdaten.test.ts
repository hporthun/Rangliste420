import { describe, it, expect } from "vitest";
import { parseStammdaten } from "../parse-stammdaten";

describe("parseStammdaten", () => {
  describe("legacy format (raw tabs, NULL or empty for null)", () => {
    it("parses a line with all fields filled", () => {
      const text = "500\tAlbani\tChiara\t2007\tfemale\t2025-10-09 19:43:29\t2025-10-09 19:43:29";
      expect(parseStammdaten(text)).toEqual([
        { externalId: 500, lastName: "Albani", firstName: "Chiara", birthYear: 2007, gender: "F" },
      ]);
    });

    it("treats NULL as missing birthYear", () => {
      const text = "744\tAkerson\tJohanna\tNULL\tfemale";
      expect(parseStammdaten(text)).toEqual([
        { externalId: 744, lastName: "Akerson", firstName: "Johanna", birthYear: null, gender: "F" },
      ]);
    });

    it("maps male to M", () => {
      const text = "722\tAlbani\tCarlo\t2010\tmale";
      expect(parseStammdaten(text)[0].gender).toBe("M");
    });
  });

  describe("PostgreSQL COPY format (quoted cells, \\N for null) — Issue #23", () => {
    it("parses a quoted line with \\N for missing birthYear", () => {
      const text = '"744"\t"Akerson besier"\t"Johanna"\t\\N\t"female"\t"2025-10-09 19:43:29"\t"2025-10-09 19:43:29"';
      expect(parseStammdaten(text)).toEqual([
        { externalId: 744, lastName: "Akerson besier", firstName: "Johanna", birthYear: null, gender: "F" },
      ]);
    });

    it("parses multiple quoted lines with mixed null markers", () => {
      const text = [
        '"744"\t"Akerson besier"\t"Johanna"\t\\N\t"female"\t"2025-10-09 19:43:29"\t"2025-10-09 19:43:29"',
        '"500"\t"Albani"\t"Chiara"\t"2007"\t"female"\t"2025-10-09 19:43:29"\t"2025-10-10 21:56:17"',
        '"722"\t"Albani"\t"Carlo"\t"2010"\t"male"\t"2025-10-09 19:43:29"\t"2025-10-10 21:57:11"',
      ].join("\n");

      expect(parseStammdaten(text)).toEqual([
        { externalId: 744, lastName: "Akerson besier", firstName: "Johanna", birthYear: null, gender: "F" },
        { externalId: 500, lastName: "Albani",          firstName: "Chiara",  birthYear: 2007, gender: "F" },
        { externalId: 722, lastName: "Albani",          firstName: "Carlo",   birthYear: 2010, gender: "M" },
      ]);
    });

    it("strips quotes from name fields with internal spaces", () => {
      const text = '"100"\t"van der Weiden"\t"Jan Erik"\t"1995"\t"male"';
      expect(parseStammdaten(text)).toEqual([
        { externalId: 100, lastName: "van der Weiden", firstName: "Jan Erik", birthYear: 1995, gender: "M" },
      ]);
    });
  });

  describe("edge cases", () => {
    it("ignores lines with too few columns", () => {
      const text = "100\tFoo\tBar\n200\tBaz\tQux\t1990\tmale";
      expect(parseStammdaten(text)).toEqual([
        { externalId: 200, lastName: "Baz", firstName: "Qux", birthYear: 1990, gender: "M" },
      ]);
    });

    it("ignores blank lines and trims trailing CR (Windows line endings)", () => {
      const text = "\r\n100\tFoo\tBar\t1990\tmale\r\n\r\n";
      expect(parseStammdaten(text)).toEqual([
        { externalId: 100, lastName: "Foo", firstName: "Bar", birthYear: 1990, gender: "M" },
      ]);
    });

    it("returns null gender for unknown values", () => {
      const text = "100\tFoo\tBar\t1990\tunknown";
      expect(parseStammdaten(text)[0].gender).toBeNull();
    });

    it("skips lines with non-numeric id", () => {
      const text = "abc\tFoo\tBar\t1990\tmale\n200\tBaz\tQux\t1990\tmale";
      expect(parseStammdaten(text)).toHaveLength(1);
      expect(parseStammdaten(text)[0].externalId).toBe(200);
    });
  });
});
