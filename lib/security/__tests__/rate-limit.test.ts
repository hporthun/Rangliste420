import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock wird ans Datei-Top gehoben — Mock-Funktionen muessen daher
// per vi.hoisted ebenfalls vorgezogen werden, sonst sind sie zur
// Mock-Aufloesungszeit noch nicht initialisiert.
const { mockFindUnique, mockUpsert, mockDeleteMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    rateLimitEntry: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
  },
}));

import { checkRateLimit, resetRateLimit } from "../rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({});
  mockDeleteMany.mockResolvedValue({ count: 0 });
});

describe("checkRateLimit", () => {
  it("erlaubt den ersten Versuch und legt einen Eintrag an", async () => {
    mockFindUnique.mockResolvedValue(null);

    const r = await checkRateLimit("login:1.2.3.4", 5, 60_000);

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(mockUpsert).toHaveBeenCalledOnce();
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ key: "login:1.2.3.4" });
    expect(JSON.parse(arg.create.timestamps)).toHaveLength(1);
  });

  it("zaehlt fortbestehende Eintraege im Fenster mit", async () => {
    const now = Date.now();
    const recent = [now - 5_000, now - 2_000];
    mockFindUnique.mockResolvedValue({ key: "k", timestamps: JSON.stringify(recent) });

    const r = await checkRateLimit("k", 5, 60_000);

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2); // 3 von 5 belegt -> 2 frei
    const arg = mockUpsert.mock.calls[0][0];
    expect(JSON.parse(arg.update.timestamps)).toHaveLength(3);
  });

  it("ignoriert abgelaufene Timestamps (Sliding-Window-Filter)", async () => {
    const now = Date.now();
    const expired = [now - 70_000, now - 65_000];
    const recent = [now - 5_000];
    mockFindUnique.mockResolvedValue({
      key: "k",
      timestamps: JSON.stringify([...expired, ...recent]),
    });

    const r = await checkRateLimit("k", 5, 60_000);

    expect(r.allowed).toBe(true);
    // Nur 1 alter Versuch zaehlt + 1 neuer = 2 belegt -> 3 frei
    expect(r.remaining).toBe(3);
    const arg = mockUpsert.mock.calls[0][0];
    const stored: number[] = JSON.parse(arg.update.timestamps);
    expect(stored).toHaveLength(2); // expired sind weg
    for (const t of stored) {
      expect(t).toBeGreaterThan(now - 60_000);
    }
  });

  it("verweigert weitere Versuche bei vollem Fenster", async () => {
    const now = Date.now();
    const full = [now - 10_000, now - 8_000, now - 5_000];
    mockFindUnique.mockResolvedValue({ key: "k", timestamps: JSON.stringify(full) });

    const r = await checkRateLimit("k", 3, 60_000);

    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetAt).toBe(full[0] + 60_000);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("toleriert kaputtes JSON im Storage und beginnt neu", async () => {
    mockFindUnique.mockResolvedValue({ key: "k", timestamps: "not-json{" });

    const r = await checkRateLimit("k", 3, 60_000);

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("toleriert nicht-Array-Werte im Storage", async () => {
    mockFindUnique.mockResolvedValue({ key: "k", timestamps: '"not an array"' });

    const r = await checkRateLimit("k", 3, 60_000);

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
});

describe("resetRateLimit", () => {
  it("ruft deleteMany mit dem Key auf", async () => {
    await resetRateLimit("login:1.2.3.4");

    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { key: "login:1.2.3.4" } });
  });

  it("wirft nicht, wenn der Eintrag nicht existiert", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });
    await expect(resetRateLimit("missing")).resolves.toBeUndefined();
  });
});
