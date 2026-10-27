import { afterEach, describe, expect, test, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("resolves true once the write lands", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  test("resolves false instead of rejecting when the browser refuses the write", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) },
    });

    await expect(copyToClipboard("hello")).resolves.toBe(false);
  });

  test("resolves false when the clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyToClipboard("hello")).resolves.toBe(false);
  });
});
