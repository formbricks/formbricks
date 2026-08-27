/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useBeforeUnloadPrompt } from "./use-before-unload-prompt";

const fireBeforeUnload = (): BeforeUnloadEvent => {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
};

describe("useBeforeUnloadPrompt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("prevents the unload when there is work to lose", () => {
    renderHook(() => useBeforeUnloadPrompt(() => true));

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  test("lets the unload through when there is nothing to lose", () => {
    renderHook(() => useBeforeUnloadPrompt(() => false));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  test("reads fresh state without re-registering the listener", () => {
    // The contract that makes the hook worth having: callers pass a plain closure over changing
    // state and the listener is attached exactly once.
    const addEventListener = vi.spyOn(window, "addEventListener");
    let isDirty = false;

    const { rerender } = renderHook(() => useBeforeUnloadPrompt(() => isDirty));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);

    isDirty = true;
    rerender();

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    expect(addEventListener.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
  });

  test("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnloadPrompt(() => true));

    unmount();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  test("registers nothing when disabled", () => {
    renderHook(() => useBeforeUnloadPrompt(() => true, { enabled: false }));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
