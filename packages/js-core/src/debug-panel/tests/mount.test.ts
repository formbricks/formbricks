// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const PANEL_STYLE = "#formbricks-debug-panel";

beforeAll(() => {
  // vitest.setup.ts swaps window and document for hand-rolled mocks; the panel draws into a real (jsdom) DOM.
  vi.unstubAllGlobals();
});

// The panel mounts as soon as its script loads, so each case sets the page up first and imports after.
const loadPanel = async (): Promise<HTMLStyleElement | null | undefined> => {
  vi.resetModules();
  await import("@/debug-panel");
  return document.querySelector(PANEL_STYLE)?.shadowRoot?.querySelector("style");
};

describe("debug panel styles", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    delete window.__formbricksNonce;
  });

  // The host page's `style-src` has no 'unsafe-inline', so a <style> without the nonce the page gave
  // `setNonce()` is blocked and the panel renders unstyled, with a violation on the customer's page.
  test("carries the CSP nonce the host page registered", async () => {
    window.__formbricksNonce = "test-nonce-123";

    const style = await loadPanel();

    expect(style?.getAttribute("nonce")).toBe("test-nonce-123");
  });

  test("sets no nonce attribute when the host page registered none", async () => {
    const style = await loadPanel();

    expect(style).toBeTruthy();
    expect(style?.hasAttribute("nonce")).toBe(false);
  });
});
