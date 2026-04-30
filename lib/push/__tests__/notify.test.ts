import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

// Hoisted mocks — Vitest erfordert vi.mock() vor allen Imports.
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    pushSubscription: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.findMany.mockReset();
  mocks.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  mocks.sendNotification.mockReset();
  mocks.setVapidDetails.mockReset();

  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("broadcastPush", () => {
  it("ohne VAPID-Konfiguration → 0/0/0, kein DB-Zugriff", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { broadcastPush } = await import("../notify");
    const res = await broadcastPush({ title: "x", body: "y" });
    expect(res).toEqual({ delivered: 0, pruned: 0, failed: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("ohne Subscriptions → 0/0/0, kein Push-Versuch", async () => {
    mocks.findMany.mockResolvedValue([]);
    const { broadcastPush } = await import("../notify");
    const res = await broadcastPush({ title: "x", body: "y" });
    expect(res).toEqual({ delivered: 0, pruned: 0, failed: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("zustellt erfolgreich → delivered = N", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "a", endpoint: "https://e/a", p256dh: "p", auth: "u" },
      { id: "b", endpoint: "https://e/b", p256dh: "p", auth: "u" },
    ]);
    mocks.sendNotification.mockResolvedValue(undefined);
    const { broadcastPush } = await import("../notify");
    const res = await broadcastPush({ title: "x", body: "y" });
    expect(res).toEqual({ delivered: 2, pruned: 0, failed: 0 });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("löscht abgemeldete Subscriptions (HTTP 410)", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "alive", endpoint: "https://e/a", p256dh: "p", auth: "u" },
      { id: "dead", endpoint: "https://e/d", p256dh: "p", auth: "u" },
    ]);
    mocks.sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === "https://e/d") {
        const err = Object.assign(new Error("Gone"), { statusCode: 410 });
        throw err;
      }
    });
    const { broadcastPush } = await import("../notify");
    const res = await broadcastPush({ title: "x", body: "y" });
    expect(res).toEqual({ delivered: 1, pruned: 1, failed: 0 });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["dead"] } },
    });
  });

  it("transienter Fehler (500) zählt als failed, nicht pruned", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "a", endpoint: "https://e/a", p256dh: "p", auth: "u" },
    ]);
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error("Backend kaputt"), { statusCode: 500 }),
    );
    const { broadcastPush } = await import("../notify");
    const res = await broadcastPush({ title: "x", body: "y" });
    expect(res).toEqual({ delivered: 0, pruned: 0, failed: 1 });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("payload wird als JSON serialisiert übergeben", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "a", endpoint: "https://e/a", p256dh: "p", auth: "u" },
    ]);
    mocks.sendNotification.mockResolvedValue(undefined);
    const { broadcastPush } = await import("../notify");
    await broadcastPush({
      title: "Neue Rangliste",
      body: "Jahresrangliste 2026",
      url: "/rangliste/abc",
      count: 1,
      tag: "ranking:abc",
    });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.sendNotification.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual({
      title: "Neue Rangliste",
      body: "Jahresrangliste 2026",
      url: "/rangliste/abc",
      count: 1,
      tag: "ranking:abc",
    });
  });
});
