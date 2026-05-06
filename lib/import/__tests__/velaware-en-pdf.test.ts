import { describe, it, expect } from "vitest";
import { parsePages } from "../velaware-en-pdf";
import velawareEnPages from "../__fixtures__/velaware-en-pages.json";
import { fixDoubleEncodedUtf8, type RawItem } from "../pdf-utils";

/**
 * Tests for velaware-en-pdf.ts using a fixture extracted from the
 * "5 Lupo Cup 420" PDF (Circolo Vela Torbole, Velaware export with English
 * column headers).
 *
 * Header layout differs from the Italian Velaware PDF:
 *   Rank | nat | sailno | Helmsman | Crew | birthdate | m/f | club | R1…R10 | Netto
 *
 * Quirks covered:
 *   - Rank with degree suffix ("1°", "32°", "100°")
 *   - `nat` as separate column (not merged into sail-number column)
 *   - Helm and Crew as two separate columns (not one comma-joined "Nome")
 *   - Multi-line cells: surnames wrap, club wraps over 2–3 PDF lines, score
 *     "(52.0\nufd)" splits across rows
 *   - Penalty without parens: "52.0\nDNC" → not discarded, code DNC
 *   - "(11.0)" plain integer-discard (no penalty code)
 *   - Multi-page (3 pages with header on each page)
 */

const result = parsePages(velawareEnPages as RawItem[][]);

describe("velaware-en-pdf parsePages – structure", () => {
  it("parses 6 entries across 3 pages", () => {
    expect(result.entries).toHaveLength(6);
  });

  it("detects 10 races", () => {
    expect(result.numRaces).toBe(10);
  });

  it("totalStarters reflects parsed entry count (pre-filter)", () => {
    expect(result.totalStarters).toBe(6);
  });
});

describe("velaware-en-pdf parsePages – entry 1 (GRE 1°, multi-line surname + multi-line discard)", () => {
  const e = result.entries[0];

  it("rank parsed despite ° suffix", () => {
    expect(e.rank).toBe(1);
  });

  it("sail number combines nat + digits", () => {
    expect(e.sailNumber).toBe("GRE 56340");
  });

  it("nationality is GRE", () => {
    expect(e.nationality).toBe("GRE");
  });

  it("helm: firstName from row 1, lastName from wrapped row 2", () => {
    expect(e.helmFirstName).toBe("Michalis");
    expect(e.helmLastName).toBe("Papadakis");
  });

  it("crew: firstName from row 1, lastName from wrapped row 2", () => {
    expect(e.crewFirstName).toBe("Alexandros");
    expect(e.crewLastName).toBe("Piperakis");
  });

  it("club parsed", () => {
    expect(e.club).toBe("N.O.P.F");
  });

  it("net points parsed", () => {
    expect(e.netPoints).toBe(29);
  });

  it("R6 multi-line cell '(52.0\\nufd)' becomes discarded UFD", () => {
    const r6 = e.raceScores.find((s) => s.race === 6)!;
    expect(r6.points).toBe(52);
    expect(r6.code).toBe("UFD");
    expect(r6.isDiscard).toBe(true);
  });

  it("UFD score in start-area triggers suggestion", () => {
    expect(e.inStartAreaSuggestion).toBe(true);
  });

  it("R1 plain '1.0' parsed as 1, not discarded", () => {
    const r1 = e.raceScores.find((s) => s.race === 1)!;
    expect(r1.points).toBe(1);
    expect(r1.isDiscard).toBe(false);
    expect(r1.code).toBeUndefined();
  });
});

describe("velaware-en-pdf parsePages – entry 2 (GRE 2°, club wraps 3 lines, plain '(11.0)' discard)", () => {
  const e = result.entries[1];

  it("rank 2", () => {
    expect(e.rank).toBe(2);
  });

  it("crew with two-word firstName stays in firstName field", () => {
    expect(e.crewFirstName).toBe("Lydia");
    expect(e.crewLastName).toBe("Rapti");
  });

  it("multi-line club joined across 3 wrap rows", () => {
    expect(e.club).toBe("NAUTICAL CLUB OF PALEON FALIRON");
  });

  it("R10 '(11.0)' is a plain integer-discard with no penalty code", () => {
    const r10 = e.raceScores.find((s) => s.race === 10)!;
    expect(r10.points).toBe(11);
    expect(r10.isDiscard).toBe(true);
    expect(r10.code).toBeUndefined();
  });

  it("entry has no DNS/BFD/OCS/UFD → inStartAreaSuggestion stays false", () => {
    expect(e.inStartAreaSuggestion).toBe(false);
  });
});

describe("velaware-en-pdf parsePages – entry 3 (CRO 3°, single-line names, plain '(23.0)' discard)", () => {
  const e = result.entries[2];

  it("nationality CRO", () => {
    expect(e.nationality).toBe("CRO");
  });

  it("helm name title-case heuristic: 'Luka Dokoza' → first/last", () => {
    expect(e.helmFirstName).toBe("Luka");
    expect(e.helmLastName).toBe("Dokoza");
  });

  it("crew name 'Pavle Mandic' parsed", () => {
    expect(e.crewFirstName).toBe("Pavle");
    expect(e.crewLastName).toBe("Mandic");
  });
});

describe("velaware-en-pdf parsePages – entry on page 2 (GER 32°)", () => {
  const e = result.entries[3];

  it("rank 32 from second page", () => {
    expect(e.rank).toBe(32);
  });

  it("nationality GER", () => {
    expect(e.nationality).toBe("GER");
  });

  it("sail number 'GER 56731'", () => {
    expect(e.sailNumber).toBe("GER 56731");
  });

  it("club 'NRV'", () => {
    expect(e.club).toBe("NRV");
  });

  it("R7 '(39.0)' is discarded plain integer", () => {
    const r7 = e.raceScores.find((s) => s.race === 7)!;
    expect(r7.points).toBe(39);
    expect(r7.isDiscard).toBe(true);
  });
});

describe("velaware-en-pdf parsePages – entry on page 3 (GER 99°, multi-line DNC sequence)", () => {
  const e = result.entries[4];

  it("rank 99 (three-digit with ° suffix)", () => {
    expect(e.rank).toBe(99);
  });

  it("R8 '(52.0\\nret)' is discarded RET", () => {
    const r8 = e.raceScores.find((s) => s.race === 8)!;
    expect(r8.points).toBe(52);
    expect(r8.code).toBe("RET");
    expect(r8.isDiscard).toBe(true);
  });

  it("R9 '52.0\\nDNC' (no parens) is non-discarded DNC", () => {
    const r9 = e.raceScores.find((s) => s.race === 9)!;
    expect(r9.points).toBe(52);
    expect(r9.code).toBe("DNC");
    expect(r9.isDiscard).toBe(false);
  });

  it("R10 '52.0\\nDNC' is non-discarded DNC", () => {
    const r10 = e.raceScores.find((s) => s.race === 10)!;
    expect(r10.points).toBe(52);
    expect(r10.code).toBe("DNC");
    expect(r10.isDiscard).toBe(false);
  });
});

describe("velaware-en-pdf parsePages – entry 100° (sail number with no NAT-prefix preview)", () => {
  const e = result.entries[5];

  it("rank 100 (three-digit)", () => {
    expect(e.rank).toBe(100);
  });

  it("sail number 'GER 50919' (NAT picked up from separate nat column)", () => {
    expect(e.sailNumber).toBe("GER 50919");
  });

  it("R4 '(51.0)' is discarded plain integer", () => {
    const r4 = e.raceScores.find((s) => s.race === 4)!;
    expect(r4.points).toBe(51);
    expect(r4.isDiscard).toBe(true);
  });
});

/**
 * Issue #66 Regressionstest: simuliert das Mojibake, das pdfjs bei manchen
 * Lupo-Cup-PDFs liefert ("Grünau" → "GrÃ¼nau"), und verifiziert, dass die
 * extractPageItems-Layer-Reparatur (fixDoubleEncodedUtf8) den End-to-End-
 * Pfad sauber durchlaufen laesst: Mojibake-Items → Helper → parsePages
 * muss dasselbe Resultat liefern wie der Direct-Parse der sauberen Fixture.
 */
function mojibakeUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

describe("velaware-en-pdf parsePages – Issue #66 Mojibake-Roundtrip", () => {
  const mojibakedPages = (velawareEnPages as RawItem[][]).map((page) =>
    page.map((it) => ({ ...it, str: mojibakeUtf8(it.str) })),
  );
  const fixedPages = mojibakedPages.map((page) =>
    page.map((it) => ({ ...it, str: fixDoubleEncodedUtf8(it.str) })),
  );
  const cleanResult = parsePages(velawareEnPages as RawItem[][]);
  const roundtripResult = parsePages(fixedPages);

  it("Mojibake-Variante enthaelt erwartete Marker (Sanity)", () => {
    const allText = mojibakedPages.flat().map((it) => it.str).join(" ");
    expect(allText).toContain("GrÃ¼nau");
  });

  it("nach fixDoubleEncodedUtf8 ist die Mojibake-Variante deckungsgleich zur Original-Fixture", () => {
    expect(fixedPages).toEqual(velawareEnPages);
  });

  it("Parse-Resultat des Roundtrips ist identisch zum Direct-Parse", () => {
    expect(roundtripResult).toEqual(cleanResult);
  });

  it("Club 'Yacht Club Berlin Grünau' kommt nach Roundtrip korrekt durch", () => {
    const clubs = roundtripResult.entries.map((e) => e.club);
    const cleanClubs = cleanResult.entries.map((e) => e.club);
    expect(clubs).toEqual(cleanClubs);
  });
});
