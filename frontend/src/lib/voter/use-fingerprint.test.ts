import { describe, expect, it, vi } from "vitest";

vi.mock("@thumbmarkjs/thumbmarkjs", () => ({
  getThumbmark: vi.fn(),
}));

describe("loadFingerprint", () => {
  it("returns an empty value when ThumbmarkJS fails", async () => {
    const thumbmark = await import("@thumbmarkjs/thumbmarkjs");
    vi.mocked(thumbmark.getThumbmark).mockRejectedValueOnce(
      new Error("fingerprint unavailable"),
    );
    const { loadFingerprint } = await import("./use-fingerprint");
    await expect(loadFingerprint()).resolves.toBe("");
  });

  it("returns the generated thumbmark", async () => {
    const thumbmark = await import("@thumbmarkjs/thumbmarkjs");
    vi.mocked(thumbmark.getThumbmark).mockResolvedValueOnce({
      thumbmark: "1234567890abcdef",
    } as never);
    const { loadFingerprint } = await import("./use-fingerprint");
    await expect(loadFingerprint()).resolves.toBe("1234567890abcdef");
  });
});
