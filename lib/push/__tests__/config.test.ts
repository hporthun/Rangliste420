import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPushConfig, isPushEnabled } from "../config";

const ORIGINAL_ENV = { ...process.env };

describe("getPushConfig", () => {
  beforeEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("liefert null, wenn ein Key fehlt", () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    expect(getPushConfig()).toBeNull();
    expect(isPushEnabled()).toBe(false);
  });

  it("liefert null, wenn alle Keys fehlen", () => {
    expect(getPushConfig()).toBeNull();
    expect(isPushEnabled()).toBe(false);
  });

  it("liefert das Config-Objekt, wenn alle drei Keys gesetzt sind", () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    expect(getPushConfig()).toEqual({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:test@example.com",
    });
    expect(isPushEnabled()).toBe(true);
  });
});
