// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("DOM readiness handling", () => {
  beforeEach(() => {
    // Reset DOM
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("ensureBodyExists resolves immediately when body exists", async () => {
    // This simulates the normal case where document.body is already available
    const ensureBodyExists = (): Promise<void> => {
      return new Promise((resolve) => {
        if (document.body) {
          resolve();
          return;
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        } else {
          const checkBody = () => {
            if (document.body) {
              resolve();
            } else {
              requestAnimationFrame(checkBody);
            }
          };
          checkBody();
        }
      });
    };

    const startTime = Date.now();
    await ensureBodyExists();
    const endTime = Date.now();

    // Should resolve almost immediately (< 10ms) when body exists
    expect(endTime - startTime).toBeLessThan(10);
  });

  test("ensureBodyExists waits for body to become available via requestAnimationFrame", async () => {
    // Simulate a scenario where document.body is initially null
    const originalBody = document.body;

    const ensureBodyExists = (): Promise<void> => {
      return new Promise((resolve) => {
        if (document.body) {
          resolve();
          return;
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        } else {
          const checkBody = () => {
            if (document.body) {
              resolve();
            } else {
              requestAnimationFrame(checkBody);
            }
          };
          checkBody();
        }
      });
    };

    // Mock document.body to be null initially
    let callCount = 0;
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

  test("safe document.head access prevents errors", () => {
    // This simulates the fix in addStylesToDom
    const addStylesToDom = () => {
      if (!document.head) {
        console.warn("addStylesToDom: document.head is not available yet");
        return;
      }

      if (document.getElementById("formbricks__css") === null) {
        const styleElement = document.createElement("style");
        styleElement.id = "formbricks__css";
        styleElement.innerHTML = ".test {}";
        document.head.appendChild(styleElement);
      }
    };

    // Test when head exists (normal case)
    addStylesToDom();
    expect(document.getElementById("formbricks__css")).not.toBeNull();

    // Test when head doesn't exist (edge case)
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalHead = document.head;

    Object.defineProperty(document, "head", {
      get: () => null,
      configurable: true,
    });

    // Should not throw error
    expect(() => addStylesToDom()).not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalledWith("addStylesToDom: document.head is not available yet");

    // Restore
    Object.defineProperty(document, "head", {
      get: () => originalHead,
      configurable: true,
    });
  });
});
