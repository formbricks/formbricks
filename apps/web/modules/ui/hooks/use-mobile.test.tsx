import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Unmock the hook to test the actual implementation
vi.unmock("@/modules/ui/hooks/use-mobile");
const { useIsMobile } = await import("./use-mobile");

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: mockMatchMedia,
});

Object.defineProperty(window, "innerWidth", {
  writable: true,
  value: 1024,
});

describe("useIsMobile", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset window.innerWidth to desktop size
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    // Default mock setup
    mockMatchMedia.mockReturnValue({
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });
  });

  test("should return false initially when window width is above mobile breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  test("should return true initially when window width is below mobile breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 600,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  test("should return true when window width equals mobile breakpoint - 1", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 767,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  test("should return false when window width equals mobile breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  test("should setup media query with correct breakpoint", () => {
    renderHook(() => useIsMobile());

    expect(mockMatchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  test("should add event listener for media query changes", () => {
    renderHook(() => useIsMobile());

    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  test("should update state when media query changes", () => {
    let changeHandler: () => void;

    mockAddEventListener.mockImplementation((event, handler) => {
      if (event === "change") {
        changeHandler = handler;
      }
    });

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Simulate window resize to mobile
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 600,
      });
      changeHandler();
    });

    expect(result.current).toBe(true);
  });

  test("should update state when window resizes from mobile to desktop", () => {
    let changeHandler: () => void;

    mockAddEventListener.mockImplementation((event, handler) => {
      if (event === "change") {
        changeHandler = handler;
      }
    });

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 600,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);

    // Simulate window resize to desktop
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 1024,
      });
      changeHandler();
    });

    expect(result.current).toBe(false);
  });

  test("should handle multiple rapid changes", () => {
    let changeHandler: () => void;

    mockAddEventListener.mockImplementation((event, handler) => {
      if (event === "change") {
        changeHandler = handler;
      }
    });

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Multiple rapid changes
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 600,
      });
      changeHandler();

      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 1024,
      });
      changeHandler();

      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 400,
      });
      changeHandler();
    });

    expect(result.current).toBe(true);
  });

  test("should remove event listener on unmount", () => {
    const { unmount } = renderHook(() => useIsMobile());

    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    const addEventListenerCall = mockAddEventListener.mock.calls.find((call) => call[0] === "change");
    const changeHandler = addEventListenerCall?.[1];

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith("change", changeHandler);
  });

  test("should handle edge case where window.innerWidth is exactly breakpoint boundary", () => {
    const testCases = [
      { width: 767, expected: true },
      { width: 768, expected: false },
      { width: 769, expected: false },
    ];

    testCases.forEach(({ width, expected }) => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: width,
      });

      const { result, unmount } = renderHook(() => useIsMobile());

      expect(result.current).toBe(expected);

      unmount();
    });
  });

  test("should work with zero width", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 0,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  test("should work with very large width", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 9999,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});
