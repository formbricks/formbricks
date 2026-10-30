import { describe, expect, test, vi } from "vitest";
import { SIGNATURE_FONT_FILE, getSignatureFontUrl, setFontBaseUrl } from "./signature-font-url";

describe("getSignatureFontUrl", () => {
  test("is undefined until the base URL is set, so no request goes to an unknown origin", async () => {
    // A fresh module instance: other tests in the process may already have set the base URL.
    vi.resetModules();
    const fresh = await import("./signature-font-url");
    expect(fresh.getSignatureFontUrl()).toBeUndefined();
  });

  test("points at the font under the app's /js/fonts with a version token", () => {
    setFontBaseUrl("https://app.formbricks.com");
    expect(getSignatureFontUrl()).toMatch(
      new RegExp(
        `^https://app\\.formbricks\\.com/js/fonts/${SIGNATURE_FONT_FILE.replace(".", "\\.")}\\?v=[\\w-]+$`
      )
    );
  });

  test("falls back to a path on the app's own origin when no appUrl is given (preview, editor)", () => {
    setFontBaseUrl(undefined);
    expect(getSignatureFontUrl()).toMatch(/^\/js\/fonts\/FormbricksSignatureScript-latin\.woff2\?v=/);
  });
});
