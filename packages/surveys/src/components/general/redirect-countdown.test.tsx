import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectCountDown } from "./redirect-countdown";

describe("RedirectCountDown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders nothing when redirectUrl is null", () => {
    const { container } = render(<RedirectCountDown redirectUrl={null} isRedirectDisabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders countdown with initial time", () => {
    render(<RedirectCountDown redirectUrl="https://example.com" isRedirectDisabled={false} />);
    expect(screen.getByText("You're redirected in")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("counts down every second", async () => {
    render(<RedirectCountDown redirectUrl="https://example.com" isRedirectDisabled={false} />);

    expect(screen.getByText("5")).toBeTruthy();

    // Advance timer by 1 second and update component
    await act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("4")).toBeTruthy();

    // Advance timer by 2 more seconds
    await act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("stops at 0 and attempts redirect when not disabled", async () => {
    const mockReplace = vi.fn();
    const originalWindow = window;
    vi.stubGlobal("window", {
      ...originalWindow,
      top: {
        location: {
          replace: mockReplace,
        },
      },
    });

    render(<RedirectCountDown redirectUrl="https://example.com" isRedirectDisabled={false} />);

    // Advance timer past countdown
    await act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText("0")).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith("https://example.com");

    // Restore original window
    vi.stubGlobal("window", originalWindow);
  });

  it("does not redirect when disabled", async () => {
    const mockReplace = vi.fn();
    const originalWindow = window;
    vi.stubGlobal("window", {
      ...originalWindow,
      top: {
        location: {
          replace: mockReplace,
        },
      },
    });

    render(<RedirectCountDown redirectUrl="https://example.com" isRedirectDisabled={true} />);

    // Advance timer past countdown
    await act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText("0")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    // Restore original window
    vi.stubGlobal("window", originalWindow);
  });

  it("cleans up interval on unmount", () => {
    const { unmount } = render(
      <RedirectCountDown redirectUrl="https://example.com" isRedirectDisabled={false} />
    );

    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
