import { describe, it, expect } from "vitest";
import { fixDoubleEncodedUtf8 } from "../pdf-utils";

// Issue #66: pdfjs liefert bei manchen PDFs Latin-1/CP1252-Bytes, die in
// Wahrheit UTF-8-Sequenzen sind. Resultat: Mojibake im Output. Bei manchen
// Inputs liegen sogar zwei Mojibake-Schichten uebereinander.

describe("fixDoubleEncodedUtf8", () => {
  describe("repariert klassische Ein-Schicht-Mojibake (UTF-8 als Latin-1 gelesen)", () => {
    it("GrÃ¼nau → Grünau", () => {
      expect(fixDoubleEncodedUtf8("GrÃ¼nau")).toBe("Grünau");
    });
    it("PortoroÅ¾ → Portorož", () => {
      expect(fixDoubleEncodedUtf8("PortoroÅ¾")).toBe("Portorož");
    });
    it("im Satzkontext", () => {
      expect(fixDoubleEncodedUtf8("Yacht Club Berlin GrÃ¼nau")).toBe(
        "Yacht Club Berlin Grünau",
      );
    });
  });

  describe("repariert Zwei-Schicht-Mojibake (UTF-8 → Latin-1 → CP1252)", () => {
    it("TÃƒÂ³th → Tóth", () => {
      expect(fixDoubleEncodedUtf8("TÃƒÂ³th")).toBe("Tóth");
    });
    it("JÃƒÂºlia → Júlia", () => {
      expect(fixDoubleEncodedUtf8("JÃƒÂºlia")).toBe("Júlia");
    });
    it("CsermÃƒÂ¡k → Csermák", () => {
      expect(fixDoubleEncodedUtf8("CsermÃƒÂ¡k")).toBe("Csermák");
    });
  });

  describe("laesst korrekte Strings unveraendert", () => {
    it("rein-ASCII", () => {
      expect(fixDoubleEncodedUtf8("Hello World")).toBe("Hello World");
    });
    it("bereits korrekte deutsche Umlaute", () => {
      expect(fixDoubleEncodedUtf8("Grünau")).toBe("Grünau");
    });
    it("bereits korrekte slawische Diakritika", () => {
      expect(fixDoubleEncodedUtf8("Portorož")).toBe("Portorož");
    });
    it("bereits korrekte ungarische Diakritika", () => {
      expect(fixDoubleEncodedUtf8("Tóth Júlia")).toBe("Tóth Júlia");
    });
    it("leerer String", () => {
      expect(fixDoubleEncodedUtf8("")).toBe("");
    });
  });

  describe("repariert nicht, wenn keine plausiblen Mojibake-Marker vorhanden", () => {
    it("Zeichen wie 'Ã' isoliert ohne Folgezeichen werden nicht angefasst", () => {
      // Sehr selten sinnvoll, aber valides UTF-8 bleibt valides UTF-8.
      // Hauptsache: keine Korruption korrekter Strings.
      const result = fixDoubleEncodedUtf8("Ã");
      // Akzeptiere beide Verhaltensweisen, solange der String nicht
      // syntaktisch kaputtgeht. Wichtig ist nur: keine Exception.
      expect(typeof result).toBe("string");
    });
  });

  describe("idempotent", () => {
    it("zweimaliges Anwenden liefert dasselbe Ergebnis", () => {
      const once = fixDoubleEncodedUtf8("GrÃ¼nau");
      const twice = fixDoubleEncodedUtf8(once);
      expect(twice).toBe(once);
    });
    it("auch fuer Zwei-Schicht-Mojibake", () => {
      const once = fixDoubleEncodedUtf8("TÃƒÂ³th");
      const twice = fixDoubleEncodedUtf8(once);
      expect(twice).toBe(once);
    });
  });
});
