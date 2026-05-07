/**
 * Reine Aggregat-Funktionen für die öffentliche Statistik-Seite.
 *
 * Eingabe: vereinfachtes RegattaStat-Modell (kein Prisma-Typ), damit die
 * Funktionen ohne DB testbar sind. Der Page-Layer mappt das DB-Ergebnis
 * auf dieses Modell.
 */

export type RegattaStat = {
  id: string;
  year: number;
  completedRaces: number;
  ranglistenFaktor: number;
  teamEntries: TeamEntryStat[];
};

export type TeamEntryStat = {
  helmId: string;
  helmFirstName: string;
  helmLastName: string;
  sailNumber: string | null;
};

export type SeasonRow = {
  year: number;
  regattaCount: number;
  raceCount: number;
  distinctHelms: number;
  distinctSailNumbers: number;
};

export type TopHelm = {
  helmId: string;
  name: string;
  regattaCount: number;
  raceCount: number;
};

export type FactorBin = {
  /** Linke Kante (inklusive). */
  binStart: number;
  /** Rechte Kante (exklusive, außer beim letzten Bin: dort inklusive). */
  binEnd: number;
  count: number;
};

/**
 * Pro Saison eine Zeile mit den Kennzahlen, sortiert nach Jahr aufsteigend.
 */
export function seasonOverview(regattas: RegattaStat[]): SeasonRow[] {
  const byYear = new Map<number, RegattaStat[]>();
  for (const r of regattas) {
    const list = byYear.get(r.year);
    if (list) list.push(r);
    else byYear.set(r.year, [r]);
  }

  const rows: SeasonRow[] = [];
  for (const [year, list] of byYear) {
    const helms = new Set<string>();
    const sails = new Set<string>();
    let raceCount = 0;
    for (const reg of list) {
      raceCount += reg.completedRaces;
      for (const te of reg.teamEntries) {
        helms.add(te.helmId);
        if (te.sailNumber) sails.add(te.sailNumber);
      }
    }
    rows.push({
      year,
      regattaCount: list.length,
      raceCount,
      distinctHelms: helms.size,
      distinctSailNumbers: sails.size,
    });
  }
  rows.sort((a, b) => a.year - b.year);
  return rows;
}

/**
 * Top-N Steuerleute eines Jahres nach Anzahl bestrittener Regatten.
 * Tie-Break: mehr Wettfahrten gesamt, dann Nachname alphabetisch.
 */
export function topActiveHelms(
  regattas: RegattaStat[],
  year: number,
  limit: number,
): TopHelm[] {
  return rankHelms(regattas, year, "regattas").slice(0, limit);
}

/**
 * Top-N Steuerleute eines Jahres nach Anzahl absolvierter Wettfahrten
 * (Summe completedRaces über alle Regatten, an denen der Helm gestartet ist).
 * Tie-Break: mehr Regatten, dann Nachname alphabetisch.
 */
export function topRaceHelms(
  regattas: RegattaStat[],
  year: number,
  limit: number,
): TopHelm[] {
  return rankHelms(regattas, year, "races").slice(0, limit);
}

function rankHelms(
  regattas: RegattaStat[],
  year: number,
  primary: "regattas" | "races",
): TopHelm[] {
  const acc = new Map<string, TopHelm>();
  for (const reg of regattas) {
    if (reg.year !== year) continue;
    const seenHelms = new Set<string>();
    for (const te of reg.teamEntries) {
      if (seenHelms.has(te.helmId)) continue;
      seenHelms.add(te.helmId);
      const existing = acc.get(te.helmId);
      if (existing) {
        existing.regattaCount += 1;
        existing.raceCount += reg.completedRaces;
      } else {
        acc.set(te.helmId, {
          helmId: te.helmId,
          name: `${te.helmFirstName} ${te.helmLastName}`.trim(),
          regattaCount: 1,
          raceCount: reg.completedRaces,
        });
      }
    }
  }

  const rows = [...acc.values()];
  rows.sort((a, b) => {
    if (primary === "regattas") {
      if (b.regattaCount !== a.regattaCount) return b.regattaCount - a.regattaCount;
      if (b.raceCount !== a.raceCount) return b.raceCount - a.raceCount;
    } else {
      if (b.raceCount !== a.raceCount) return b.raceCount - a.raceCount;
      if (b.regattaCount !== a.regattaCount) return b.regattaCount - a.regattaCount;
    }
    return a.name.localeCompare(b.name, "de");
  });
  return rows;
}

/**
 * Histogramm der Ranglistenfaktoren f eines Jahres.
 * Bins in 0.2-Schritten von 0.8 bis 2.6 (DSV-Wertebereich).
 */
export function factorHistogram(
  regattas: RegattaStat[],
  year: number,
): FactorBin[] {
  const bins: FactorBin[] = [];
  const step = 0.2;
  for (let start = 0.8; start < 2.6 - 1e-9; start += step) {
    bins.push({
      binStart: round1(start),
      binEnd: round1(start + step),
      count: 0,
    });
  }

  for (const reg of regattas) {
    if (reg.year !== year) continue;
    const f = reg.ranglistenFaktor;
    if (f < 0.8 || f > 2.6) continue;
    // Integer-Arithmetik vermeidet Floating-Point-Fehler an Bin-Kanten
    // (z.B. f=1.0 würde mit (1.0-0.8)/0.2 = 0.9999… falsch in Bin 0 fallen).
    // Linke Kante inklusive, rechte exklusive (außer letzter Bin: inklusive).
    const scaled = Math.round(f * 1000);
    let idx = Math.floor((scaled - 800) / 200);
    if (idx >= bins.length) idx = bins.length - 1;
    if (idx < 0) idx = 0;
    bins[idx]!.count += 1;
  }
  return bins;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Liste aller Jahre mit mindestens einer Regatta, absteigend (jüngstes zuerst).
 */
export function listYears(regattas: RegattaStat[]): number[] {
  const set = new Set<number>();
  for (const r of regattas) set.add(r.year);
  return [...set].sort((a, b) => b - a);
}
