import { describe, it, expect } from "vitest";
import {
  seasonOverview,
  topActiveHelms,
  topRaceHelms,
  factorHistogram,
  listYears,
  filterRegattas,
  type RegattaStat,
  type TeamEntryStat,
} from "../aggregates";

type HelmOptions = {
  sailNumber?: string | null;
  helmBirthYear?: number | null;
  helmGender?: string | null;
  crewBirthYear?: number | null;
  crewGender?: string | null;
};

function helm(
  helmId: string,
  firstName: string,
  lastName: string,
  opts: HelmOptions = {},
): TeamEntryStat {
  return {
    helmId,
    helmFirstName: firstName,
    helmLastName: lastName,
    sailNumber: opts.sailNumber ?? null,
    helmBirthYear: opts.helmBirthYear ?? null,
    helmGender: opts.helmGender ?? null,
    crewBirthYear: opts.crewBirthYear ?? null,
    crewGender: opts.crewGender ?? null,
  };
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
        teamEntries: [
          helm("h1", "Anna", "B", { sailNumber: "1" }),
          helm("h2", "Ben", "C", { sailNumber: "2" }),
        ],
      }),
      regatta({
        id: "r2",
        year: 2024,
        completedRaces: 4,
        teamEntries: [
          helm("h1", "Anna", "B", { sailNumber: "1" }),
          helm("h3", "Cara", "D", { sailNumber: "3" }),
        ],
      }),
      regatta({
        id: "r3",
        year: 2025,
        completedRaces: 7,
        teamEntries: [helm("h2", "Ben", "C", { sailNumber: "2" })],
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
        teamEntries: [helm("h1", "A", "B"), helm("h2", "C", "D")],
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

describe("filterRegattas", () => {
  // Hilfs-Setup: zwei Regatten mit gemischten Helms.
  const mkData = (): RegattaStat[] => [
    regatta({
      id: "r1",
      year: 2025,
      teamEntries: [
        helm("h_boy_y", "Max", "U16", {
          helmBirthYear: 2010, // im Saisonjahr 2025: 15 Jahre → U16 (max 15) ✓
          helmGender: "M",
          crewBirthYear: 2010,
          crewGender: "M",
        }),
        helm("h_girl_y", "Lea", "U16", {
          helmBirthYear: 2010,
          helmGender: "F",
          crewBirthYear: 2010,
          crewGender: "F",
        }),
        helm("h_old", "Ana", "Open", {
          helmBirthYear: 1990,
          helmGender: "F",
          crewBirthYear: 1990,
          crewGender: "F",
        }),
      ],
    }),
    regatta({
      id: "r2",
      year: 2025,
      teamEntries: [
        helm("h_no_data", "X", "Y"), // alles null
        helm("h_no_crew", "Z", "W", {
          helmBirthYear: 2010,
          helmGender: "M",
          // keine Crew → bei MEN/U16 ausgeschlossen
        }),
      ],
    }),
  ];

  it("OPEN/OPEN gibt unveränderte Liste zurück", () => {
    const data = mkData();
    expect(filterRegattas(data, "OPEN", "OPEN")).toEqual(data);
  });

  it("U16 + GIRLS lässt nur das Girls-Team mit passendem Alter durch", () => {
    const filtered = filterRegattas(mkData(), "U16", "GIRLS");
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.teamEntries.map((te) => te.helmId)).toEqual(["h_girl_y"]);
  });

  it("U16 + MEN lässt das Boy-Team durch, schließt h_no_crew aus", () => {
    const filtered = filterRegattas(mkData(), "U16", "MEN");
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.teamEntries.map((te) => te.helmId)).toEqual(["h_boy_y"]);
  });

  it("Regatta ohne passende Einträge wird komplett verworfen", () => {
    // h_old ist Open-Alter, kein Match in U16
    const data: RegattaStat[] = [
      regatta({
        id: "only-old",
        year: 2025,
        teamEntries: [
          helm("h_old", "Ana", "Open", {
            helmBirthYear: 1990,
            helmGender: "F",
            crewBirthYear: 1990,
            crewGender: "F",
          }),
        ],
      }),
    ];
    expect(filterRegattas(data, "U16", "OPEN")).toEqual([]);
  });

  it("Stammdaten-frei → ausgeschlossen sobald Filter gesetzt", () => {
    const data: RegattaStat[] = [
      regatta({
        id: "r1",
        year: 2025,
        teamEntries: [helm("h_no_data", "X", "Y")],
      }),
    ];
    expect(filterRegattas(data, "OPEN", "MEN")).toEqual([]);
    expect(filterRegattas(data, "U17", "OPEN")).toEqual([]);
  });
});
