import { describe, it, expect, vi } from "vitest";

vi.mock("../pdf-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pdf-utils")>();
  return {
    ...actual,
    extractPageItems: vi.fn(),
  };
});

describe("parsePdf – image-only PDF", () => {
  it("throws a clear error when every page has zero text items", async () => {
    const utils = await import("../pdf-utils");
    const { parsePdf } = await import("../pdf-auto-detect");

    vi.mocked(utils.extractPageItems).mockResolvedValueOnce([[], [], [], [], []]);

    await expect(parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).rejects.toThrow(
      /keine Textebene/i
    );
  });

  it("does not trigger the image-only error when at least one page has items", async () => {
    const utils = await import("../pdf-utils");
    const { parsePdf } = await import("../pdf-auto-detect");

    vi.mocked(utils.extractPageItems).mockResolvedValueOnce([
      [],
      [{ str: "irrelevant", x: 0, y: 0 }],
    ]);

    // Falls back to the existing "no entries / not German" error, not the new one
    await expect(parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).rejects.toThrow(
      /Keine Ergebnisse/
    );
  });
});
