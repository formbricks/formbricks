// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ensureBodyExists } from "./dom-utils";

describe("ensureBodyExists", () => {
  beforeEach(() => {
    // Reset DOM
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves immediately when body exists", async () => {
    const startTime = Date.now();
    await ensureBodyExists();
    const endTime = Date.now();

    // Should resolve almost immediately (< 10ms) when body exists
    expect(endTime - startTime).toBeLessThan(10);
  });

  test("waits for body to become available via requestAnimationFrame", async () => {
    const originalBody = document.body;
    let callCount = 0;

    // Mock document.body to be null initially
    Object.defineProperty(document, "body", {
      get: () => {
        callCount++;
        // Return null for first 2 calls, then return actual body
        return callCount <= 2 ? null : originalBody;
      },
      configurable: true,
    });

    await ensureBodyExists();

    // Should have checked multiple times
    expect(callCount).toBeGreaterThan(2);

    // Restore original body
    Object.defineProperty(document, "body", {
      get: () => originalBody,
      configurable: true,
    });
  });

  test("waits for DOMContentLoaded when readyState is loading", async () => {
    const originalBody = document.body;
    const originalReadyState = document.readyState;

    // Mock readyState to be loading
    Object.defineProperty(document, "readyState", {
      get: () => "loading",
      configurable: true,
    });

    // Mock document.body to be null initially
    Object.defineProperty(document, "body", {
      get: () => null,
      configurable: true,
    });

    const promise = ensureBodyExists();

    // Simulate DOMContentLoaded event
    setTimeout(() => {
      // Restore body before triggering event
      Object.defineProperty(document, "body", {
        get: () => originalBody,
        configurable: true,
      });
      document.dispatchEvent(new Event("DOMContentLoaded"));
    }, 10);

    await promise;

    // Should have resolved after DOMContentLoaded
    expect(true).toBe(true);

    // Restore original readyState
    Object.defineProperty(document, "readyState", {
      get: () => originalReadyState,
      configurable: true,
    });
  });

  test("handles edge case where body appears between checks", async () => {
    const originalBody = document.body;

    // Mock body to appear after first check
    let firstCheck = true;
    Object.defineProperty(document, "body", {
      get: () => {
        if (firstCheck) {
          firstCheck = false;
          return null;
        }
        return originalBody;
      },
      configurable: true,
    });

    await ensureBodyExists();

    // Should have resolved successfully
    expect(firstCheck).toBe(false);

    // Restore original body
    Object.defineProperty(document, "body", {
      get: () => originalBody,
      configurable: true,
    });
  });
});
