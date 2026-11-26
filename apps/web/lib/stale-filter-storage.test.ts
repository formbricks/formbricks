import { afterEach, describe, expect, test, vi } from "vitest";
import { STALE_FILTER_STORAGE_KEYS, removeStaleFilterStorage } from "./stale-filter-storage";

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
  vi.unstubAllGlobals();
});

describe("removeStaleFilterStorage", () => {
  test("removes the old Surveys, Workflows and Creatives filter keys", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    removeStaleFilterStorage();
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual(STALE_FILTER_STORAGE_KEYS);
    expect(STALE_FILTER_STORAGE_KEYS).toEqual([
      "formbricks-surveys-filters",
      "formbricks-workflows-filters",
      "formbricks-creatives-filters",
    ]);
  });

  test("does nothing when removeItem is blocked", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    expect(() => removeStaleFilterStorage()).not.toThrow();
  });

  // Safari with "Block all cookies": reading the `localStorage` property itself throws, which the
  // list pages used to do outside any guard while passing storage in.
  test("does nothing when reading localStorage itself is denied", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    expect(() => removeStaleFilterStorage()).not.toThrow();
  });
});
