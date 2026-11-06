/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { FLOW_TAB_SEEN_STORAGE_KEY, hasSeenFlowTab, markFlowTabSeen } from "./flow-tab-notice";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the one-time 'Logic has moved' notice", () => {
  test("shows until the Flow tab has been opened once in this browser", () => {
    expect(hasSeenFlowTab()).toBe(false);

    markFlowTabSeen();

    expect(hasSeenFlowTab()).toBe(true);
    expect(window.localStorage.getItem(FLOW_TAB_SEEN_STORAGE_KEY)).not.toBeNull();
  });

  test("a value this build did not write does not count as seen", () => {
    window.localStorage.setItem(FLOW_TAB_SEEN_STORAGE_KEY, "maybe");

    expect(hasSeenFlowTab()).toBe(false);
  });

  test("a browser that refuses storage still shows the notice and doesn't throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => markFlowTabSeen()).not.toThrow();
    expect(hasSeenFlowTab()).toBe(false);
  });
});
