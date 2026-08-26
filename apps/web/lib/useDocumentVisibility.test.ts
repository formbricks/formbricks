/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useDocumentVisibility } from "./useDocumentVisibility";

const setVisibilityState = (state: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);

const fireVisibilityChange = () => document.dispatchEvent(new Event("visibilitychange"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDocumentVisibility", () => {
  test("calls onVisible when the document becomes visible", () => {
    setVisibilityState("visible");
    const onVisible = vi.fn();
    renderHook(() => useDocumentVisibility(onVisible));

    fireVisibilityChange();

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  test("does not call onVisible while the document is hidden", () => {
    setVisibilityState("hidden");
    const onVisible = vi.fn();
    renderHook(() => useDocumentVisibility(onVisible));

    fireVisibilityChange();

    expect(onVisible).not.toHaveBeenCalled();
  });

  test("invokes the latest callback after a re-render without re-subscribing", () => {
    setVisibilityState("visible");
    const addEventListener = vi.spyOn(document, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ onVisible }) => useDocumentVisibility(onVisible), {
      initialProps: { onVisible: first },
    });

    const visibilitySubscriptions = () =>
      addEventListener.mock.calls.filter(([event]) => event === "visibilitychange");
    const subscriptionsAfterMount = visibilitySubscriptions().length;

    rerender({ onVisible: second });
    fireVisibilityChange();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(visibilitySubscriptions()).toHaveLength(subscriptionsAfterMount);
  });

  test("stops listening after unmount", () => {
    setVisibilityState("visible");
    const onVisible = vi.fn();
    const { unmount } = renderHook(() => useDocumentVisibility(onVisible));

    unmount();
    fireVisibilityChange();

    expect(onVisible).not.toHaveBeenCalled();
  });
});
