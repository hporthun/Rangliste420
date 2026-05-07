import { describe, it, expect } from "vitest";
import {
  seasonOverview,
  topActiveHelms,
  topRaceHelms,
  factorHistogram,
  listYears,
  type RegattaStat,
} from "../aggregates";

function helm(
  helmId: string,
  firstName: string,
  lastName: string,
  sailNumber: string | null = null,
) {
  return { helmId, helmFirstName: firstName, helmLastName: lastName, sailNumber };
}

function regatta(opts: Partial<RegattaStat> & { id: string; year: number }): RegattaStat {
  return {
    completedRaces: 5,
    ranglistenFaktor: 1.0,
    teamEntries: [],
    ...opts,
  };
}

describe("seasonOverview", () => {
  it("aggregiert pro Jahr und sortiert aufsteigend", () => {
    const regattas: RegattaStat[] = [
      regatta({
        id: "r1",
        year: 2024,
        completedRaces: 6,
        teamEntries: [helm("h1", "Anna", "B", "1"), helm("h2", "Ben", "C", "2")],
      }),
      regatta({
        id: "r2",
        year: 2024,
        completedRaces: 4,
        teamEntries: [helm("h1", "Anna", "B", "1"), helm("h3", "Cara", "D", "3")],
      }),
      regatta({
        id: "r3",
        year: 2025,
        completedRaces: 7,
        teamEntries: [helm("h2", "Ben", "C", "2")],
      }),
    ];

    const rows = seasonOverview(regattas);
    expect(rows).toEqual([
      {
        year: 2024,
        regattaCount: 2,
        raceCount: 10,
        distinctHelms: 3,
        distinctSailNumbers: 3,
      },
      {
        year: 2025,
        regattaCount: 1,
        raceCount: 7,
        distinctHelms: 1,
        distinctSailNumbers: 1,
      },
    ]);
  });

  it("zählt sailNumber=null nicht in distinctSailNumbers", () => {
    const rows = seasonOverview([
      regatta({
        id: "r1",
        year: 2025,
        completedRaces: 3,
        teamEntries: [helm("h1", "A", "B", null), helm("h2", "C", "D", null)],
      }),
    ]);
    expect(rows[0]).toMatchObject({ distinctHelms: 2, distinctSailNumbers: 0 });
  });

  it("leerer Input → leere Liste", () => {
    expect(seasonOverview([])).toEqual([]);
  });
});

describe("topActiveHelms", () => {
  const data: RegattaStat[] = [
    regatta({
      id: "r1",
      year: 2025,
      completedRaces: 6,
      teamEntries: [helm("h1", "Anna", "Boe"), helm("h2", "Ben", "Coe")],
    }),
    regatta({
      id: "r2",
      year: 2025,
      completedRaces: 4,
      teamEntries: [helm("h1", "Anna", "Boe"), helm("h3", "Cara", "Doe")],
    }),
    regatta({
      id: "r3",
      year: 2025,
      completedRaces: 5,
      teamEntries: [helm("h1", "Anna", "Boe")],
    }),
    regatta({
      id: "r-other-year",
      year: 2024,
      completedRaces: 99,
      teamEntries: [helm("h2", "Ben", "Coe")],
    }),
  ];

  it("zählt Regatten pro Helm im Zieljahr", () => {
    const top = topActiveHelms(data, 2025, 10);
    expect(top.map((t) => [t.helmId, t.regattaCount, t.raceCount])).toEqual([
      ["h1", 3, 15],
      ["h2", 1, 6],
      ["h3", 1, 4],
    ]);
  });

  it("zählt einen Helm nicht doppelt, wenn er mehrfach bei einer Regatta auftaucht", () => {
    // Sollte in der Praxis durch @@unique verhindert sein, aber Aggregat
    // muss robust bleiben.
    const dup: RegattaStat[] = [
      regatta({
        id: "r1",
        year: 2025,
        completedRaces: 5,
        teamEntries: [helm("h1", "A", "B"), helm("h1", "A", "B")],
      }),
    ];
    expect(topActiveHelms(dup, 2025, 10)).toEqual([
      { helmId: "h1", name: "A B", regattaCount: 1, raceCount: 5 },
    ]);
  });

  it("limit begrenzt die Liste", () => {
    const top = topActiveHelms(data, 2025, 2);
    expect(top.map((t) => t.helmId)).toEqual(["h1", "h2"]);
  });

  it("Tie-Break: gleiche Regattenzahl → mehr Wettfahrten zuerst", () => {
    const tied: RegattaStat[] = [
      regatta({
        id: "r1",
        year: 2025,
        completedRaces: 8,
        teamEntries: [helm("h_more", "Anna", "X")],
      }),
      regatta({
        id: "r2",
        year: 2025,
        completedRaces: 3,
        teamEntries: [helm("h_less", "Ben", "Y")],
      }),
    ];
    const top = topActiveHelms(tied, 2025, 10);
    expect(top.map((t) => t.helmId)).toEqual(["h_more", "h_less"]);
  });
});

describe("topRaceHelms", () => {
  it("sortiert primär nach raceCount", () => {
    const data: RegattaStat[] = [
      regatta({
        id: "r1",
        year: 2025,
        completedRaces: 12,
        teamEntries: [helm("h_big", "B", "Big")],
      }),
      regatta({
        id: "r2",
        year: 2025,
        completedRaces: 3,
        teamEntries: [helm("h_a", "A", "Aa"), helm("h_z", "Z", "Zz")],
      }),
      regatta({
        id: "r3",
        year: 2025,
        completedRaces: 3,
        teamEntries: [helm("h_a", "A", "Aa")],
      }),
    ];
    const top = topRaceHelms(data, 2025, 10);
    expect(top[0]).toMatchObject({ helmId: "h_big", raceCount: 12 });
    expect(top[1]).toMatchObject({ helmId: "h_a", raceCount: 6 });
    expect(top[2]).toMatchObject({ helmId: "h_z", raceCount: 3 });
  });
});

describe("factorHistogram", () => {
  it("verteilt Faktoren auf 0.2-Bins zwischen 0.8 und 2.6", () => {
    const data: RegattaStat[] = [
      regatta({ id: "r1", year: 2025, ranglistenFaktor: 0.8 }),
      regatta({ id: "r2", year: 2025, ranglistenFaktor: 0.95 }),
      regatta({ id: "r3", year: 2025, ranglistenFaktor: 1.0 }),
      regatta({ id: "r4", year: 2025, ranglistenFaktor: 1.4 }),
      regatta({ id: "r5", year: 2025, ranglistenFaktor: 2.6 }),
    ];
    const bins = factorHistogram(data, 2025);
    expect(bins.length).toBe(9); // 0.8-1.0, 1.0-1.2, ..., 2.4-2.6
    expect(bins[0]).toEqual({ binStart: 0.8, binEnd: 1.0, count: 2 }); // 0.8 + 0.95
    expect(bins[1]).toEqual({ binStart: 1.0, binEnd: 1.2, count: 1 }); // 1.0
    expect(bins[3]).toEqual({ binStart: 1.4, binEnd: 1.6, count: 1 }); // 1.4
    expect(bins[8]).toEqual({ binStart: 2.4, binEnd: 2.6, count: 1 }); // 2.6 → letzter Bin
  });

  it("ignoriert Regatten anderer Jahre", () => {
    const data: RegattaStat[] = [
      regatta({ id: "r1", year: 2024, ranglistenFaktor: 1.0 }),
      regatta({ id: "r2", year: 2025, ranglistenFaktor: 1.0 }),
    ];
    const bins = factorHistogram(data, 2025);
    expect(bins[1]!.count).toBe(1);
  });

  it("ignoriert Faktoren außerhalb 0.8–2.6", () => {
    const data: RegattaStat[] = [
      regatta({ id: "r1", year: 2025, ranglistenFaktor: 0.5 }),
      regatta({ id: "r2", year: 2025, ranglistenFaktor: 3.0 }),
    ];
    const bins = factorHistogram(data, 2025);
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });
});

describe("listYears", () => {
  it("liefert distinct Jahre absteigend", () => {
    const data: RegattaStat[] = [
      regatta({ id: "a", year: 2023 }),
      regatta({ id: "b", year: 2025 }),
      regatta({ id: "c", year: 2025 }),
      regatta({ id: "d", year: 2024 }),
    ];
    expect(listYears(data)).toEqual([2025, 2024, 2023]);
  });
});
