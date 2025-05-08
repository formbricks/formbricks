/// <reference types="vitest" />
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useDocumentVisibility } from "./useDocumentVisibility";

describe("useDocumentVisibility", () => {
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCallback = vi.fn();
    // Reset document.visibilityState to "visible" before each test
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
    });
    vi.clearAllMocks();
  });

  test("should call the callback when document becomes visible", () => {
    renderHook(() => useDocumentVisibility(mockCallback));

    // Simulate document becoming visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  test("should not call the callback when document becomes hidden", () => {
    renderHook(() => useDocumentVisibility(mockCallback));

    // Simulate document becoming hidden
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockCallback).not.toHaveBeenCalled();
  });

  test("should add and remove event listener correctly", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useDocumentVisibility(mockCallback));

    expect(addEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
