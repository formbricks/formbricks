import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ScrollToTop from "./ScrollToTop";

const containerId = "test-container";

describe("ScrollToTop", () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    mockContainer = document.createElement("div");
    mockContainer.id = containerId;
    mockContainer.scrollTop = 0;
    mockContainer.scrollTo = vi.fn();
    mockContainer.addEventListener = vi.fn();
    mockContainer.removeEventListener = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue(mockContainer);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders hidden initially", () => {
    render(<ScrollToTop containerId={containerId} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("opacity-0");
  });

  test("calls scrollTo on button click", async () => {
    render(<ScrollToTop containerId={containerId} />);
    const button = screen.getByRole("button");

    // Make button visible
    mockContainer.scrollTop = 301;
    const scrollEvent = new Event("scroll");
    mockContainer.dispatchEvent(scrollEvent);

    await userEvent.click(button);
    expect(mockContainer.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  test("does nothing if container is not found", () => {
    vi.spyOn(document, "getElementById").mockReturnValue(null);
    render(<ScrollToTop containerId="non-existent-container" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("opacity-0"); // Stays hidden

    // Try to simulate scroll (though no listener would be attached)
    fireEvent.scroll(window, { target: { scrollY: 400 } });
    expect(button).toHaveClass("opacity-0");

    // Try to click
    userEvent.click(button);
    // No error should occur, and scrollTo should not be called on a null element
  });

  test("removes event listener on unmount", () => {
    const { unmount } = render(<ScrollToTop containerId={containerId} />);
    expect(mockContainer.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));

    unmount();
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
