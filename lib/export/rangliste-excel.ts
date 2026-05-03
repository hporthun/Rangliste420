/**
 * Excel-Export einer Rangliste — fuer angemeldete Benutzer.
 *
 * Erzeugt ein xlsx mit zwei Bloecken pro DSV/IDJM-Rangliste:
 *  - "Rangliste": Platz, Name, Verein, R, Wertungen, Crew(s)
 *  - "Noch nicht in der Wertung": Name, Verein, Wertungen, Crew(s)
 *
 * Fuer JWM/JEM eine eigene Form: ranked + preliminary + excludedSwap mit
 * Quali-Score und Per-Regatta-Slots.
 *
 * Liefert ein Uint8Array, das die API-Route als Body zurueckgibt.
 */

import ExcelJS from "exceljs";
import type { RankingComputeResult } from "@/lib/actions/rankings";
import type { JwmJemComputeResult } from "@/lib/actions/jwm-jem";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });
}

function partnersJoined(
  parts: { id: string; firstName: string; lastName: string; birthYearMissing?: boolean }[],
  birthYearMap: Map<string, number | null>
): string {
  return parts
    .map((p) => {
      const by = birthYearMap.get(p.id);
      const base = `${p.firstName} ${p.lastName}`;
      if (by != null) return `${base}, Jg. ${by}`;
      if (p.birthYearMissing) return `${base} (ohne Jg.)`;
      return base;
    })
    .join(", ");
}

type Meta = {
  rankingName: string;
  effectiveAge: string;
  effectiveGender: string;
  scoringUnit: "HELM" | "CREW";
  seasonStart: Date;
  seasonEnd: Date;
};

export async function buildDsvRanglisteWorkbook(
  meta: Meta,
  data: RankingComputeResult,
  birthYearMap: Map<string, number | null>
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "420er Rangliste";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rangliste");

  // Meta header
  ws.addRow([meta.rankingName]).font = { bold: true, size: 14 };
  ws.addRow([
    `Kategorie: ${meta.effectiveAge} / ${meta.effectiveGender}`,
    `Saison: ${meta.seasonStart.toISOString().slice(0, 10)} – ${meta.seasonEnd.toISOString().slice(0, 10)}`,
    `Wertung: ${meta.scoringUnit === "CREW" ? "Vorschoter" : "Steuermann"}`,
  ]);
  ws.addRow([]);

  // Hauptliste
  const partnerLabel = meta.scoringUnit === "CREW" ? "Steuermann" : "Crew";
  const headerRow = ws.addRow(["Platz", "Name", "Jahrgang", "Verein", "R", "Wertungen", partnerLabel]);
  styleHeaderRow(headerRow);

  for (const row of data.rows) {
    ws.addRow([
      row.rank,
      `${row.firstName} ${row.lastName}`,
      birthYearMap.get(row.sailorId) ?? "",
      row.club ?? "",
      Number(row.R.toFixed(2)),
      row.valuesCount,
      partnersJoined(row.partners, birthYearMap),
    ]);
  }

  // Spaltenbreiten
  ws.columns = [
    { width: 6 },
    { width: 28 },
    { width: 9 },
    { width: 32 },
    { width: 8 },
    { width: 10 },
    { width: 36 },
  ];

  if (data.belowCutoff.length > 0) {
    ws.addRow([]);
    const subHeader = ws.addRow(["Noch nicht in der Wertung (< 9 Wertungen)"]);
    subHeader.font = { bold: true, italic: true };
    const belowHeaderRow = ws.addRow(["", "Name", "Jahrgang", "Verein", "", "Wertungen", partnerLabel]);
    styleHeaderRow(belowHeaderRow);

    for (const row of data.belowCutoff) {
      ws.addRow([
        "",
        `${row.firstName} ${row.lastName}`,
        birthYearMap.get(row.sailorId) ?? "",
        row.club ?? "",
        "",
        `${row.valuesCount} / 9`,
        partnersJoined(row.partners, birthYearMap),
      ]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

export async function buildJwmJemWorkbook(
  meta: Meta & { typeLabel: string },
  data: JwmJemComputeResult,
  birthYearMap: Map<string, number | null>
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "420er Rangliste";
  wb.created = new Date();

  const ws = wb.addWorksheet("Quali");
  ws.addRow([meta.rankingName]).font = { bold: true, size: 14 };
  ws.addRow([
    meta.typeLabel,
    `Kategorie: ${meta.effectiveAge} / ${meta.effectiveGender}`,
    `Saison: ${meta.seasonStart.toISOString().slice(0, 10)} – ${meta.seasonEnd.toISOString().slice(0, 10)}`,
  ]);
  ws.addRow([]);

  // Regatta-Spalten
  const regs = data.regattas;
  const fixedHeaders = ["Platz", "Name", "Jahrgang", "Verein", "Quali-Score", "Crew(s)"];
  const headerRow = ws.addRow([...fixedHeaders, ...regs.map((r) => r.name)]);
  styleHeaderRow(headerRow);

  function pushSection(label: string, rows: typeof data.ranked) {
    if (rows.length === 0) return;
    ws.addRow([]);
    const sub = ws.addRow([label]);
    sub.font = { bold: true, italic: true };

    for (const row of rows) {
      const slotsByReg = new Map(row.slots.map((s) => [s.regattaId, s]));
      const slotCells = regs.map((r) => {
        const s = slotsByReg.get(r.id);
        if (!s || s.finalRank == null) return "";
        return s.weightedScore != null ? `${s.finalRank}. (${s.weightedScore.toFixed(2)})` : `${s.finalRank}.`;
      });
      ws.addRow([
        row.rank ?? "",
        `${row.firstName} ${row.lastName}`,
        birthYearMap.get(row.helmId) ?? "",
        row.club ?? "",
        Number(row.qualiScore.toFixed(2)),
        partnersJoined(row.crews, birthYearMap),
        ...slotCells,
      ]);
    }
  }

  pushSection("Qualifikationsrangliste", data.ranked);
  pushSection("Vorlaeufig / Zwischenergebnis", data.preliminary);
  pushSection("Nicht gewertet — ungenehmigter Schottenwechsel", data.excludedSwap);

  ws.columns = [
    { width: 6 },
    { width: 28 },
    { width: 9 },
    { width: 32 },
    { width: 12 },
    { width: 36 },
    ...regs.map(() => ({ width: 16 })),
  ];

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}
