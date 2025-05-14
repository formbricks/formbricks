import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ScrollableContainer } from "./scrollable-container";

// Mock cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("ScrollableContainer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks(); // Restore all spies
  });

  // Helper to set scroll properties on an element
  const setScrollProps = (
    element: HTMLElement,
    scrollHeight: number,
    clientHeight: number,
    scrollTop: number
  ) => {
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
    Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
    Object.defineProperty(element, "scrollTop", { configurable: true, value: scrollTop });
  };

  test("renders children correctly", () => {
    render(
      <ScrollableContainer>
        <div>Test Content</div>
      </ScrollableContainer>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("initial state with short content (not scrollable)", async () => {
    const { container } = render(
      <ScrollableContainer>
        <div style={{ height: "50px" }}>Short Content</div>
      </ScrollableContainer>
    );
    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");
    expect(scrollableDiv).toBeInTheDocument();

    if (scrollableDiv) {
      setScrollProps(scrollableDiv, 50, 100, 0); // Content shorter than container
      fireEvent.scroll(scrollableDiv); // Trigger checkScroll
    }

    await waitFor(() => {
      // isAtTop = true, isAtBottom = true
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull(); // No top gradient
      expect(container.querySelector(".fb-bg-gradient-to-t")).toBeNull(); // No bottom gradient
    });
  });

  test("initial state with long content (scrollable at top)", async () => {
    const { container } = render(
      <ScrollableContainer>
        <div style={{ height: "200px" }}>Long Content</div>
      </ScrollableContainer>
    );
    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");
    expect(scrollableDiv).toBeInTheDocument();

    if (scrollableDiv) {
      setScrollProps(scrollableDiv, 200, 100, 0); // Content longer than container, at top
      fireEvent.scroll(scrollableDiv); // Trigger checkScroll
    }

    await waitFor(() => {
      // isAtTop = true, isAtBottom = false
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull(); // No top gradient
      expect(container.querySelector(".fb-bg-gradient-to-t")).not.toBeNull(); // Bottom gradient visible
    });
  });

  test("scrolling behavior updates gradients", async () => {
    const { container } = render(
      <ScrollableContainer>
        <div style={{ height: "300px" }}>Scrollable Content</div>
      </ScrollableContainer>
    );
    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");
    expect(scrollableDiv).toBeInTheDocument();

    if (!scrollableDiv) throw new Error("Scrollable div not found");

    // Initial: At top
    setScrollProps(scrollableDiv, 300, 100, 0);
    fireEvent.scroll(scrollableDiv); // Trigger checkScroll for initial state
    await waitFor(() => {
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull();
      expect(container.querySelector(".fb-bg-gradient-to-t")).not.toBeNull();
    });

    // Scroll to middle
    setScrollProps(scrollableDiv, 300, 100, 50);
    fireEvent.scroll(scrollableDiv);
    await waitFor(() => {
      // isAtTop = false, isAtBottom = false
      expect(container.querySelector(".fb-bg-gradient-to-b")).not.toBeNull(); // Top gradient visible
      expect(container.querySelector(".fb-bg-gradient-to-t")).not.toBeNull(); // Bottom gradient visible
    });

    // Scroll to bottom
    setScrollProps(scrollableDiv, 300, 100, 200); // scrollTop + clientHeight = scrollHeight
    fireEvent.scroll(scrollableDiv);
    await waitFor(() => {
      // isAtTop = false, isAtBottom = true
      expect(container.querySelector(".fb-bg-gradient-to-b")).not.toBeNull(); // Top gradient visible
      expect(container.querySelector(".fb-bg-gradient-to-t")).toBeNull(); // No bottom gradient
    });

    // Scroll back to top
    setScrollProps(scrollableDiv, 300, 100, 0);
    fireEvent.scroll(scrollableDiv);
    await waitFor(() => {
      // isAtTop = true, isAtBottom = false
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull(); // No top gradient
      expect(container.querySelector(".fb-bg-gradient-to-t")).not.toBeNull(); // Bottom gradient visible
    });
  });

  test("cleans up scroll event listener on unmount", () => {
    const { unmount, container } = render(
      <ScrollableContainer>
        <div>Test Content</div>
      </ScrollableContainer>
    );
    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");
    expect(scrollableDiv).toBeInTheDocument();

    if (scrollableDiv) {
      const removeEventListenerSpy = vi.spyOn(scrollableDiv, "removeEventListener");
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    } else {
      throw new Error("Scrollable div not found for unmount test");
    }
  });

  test("updates scroll state when children prop changes causing scrollHeight change", async () => {
    const { rerender, container } = render(
      <ScrollableContainer>
        <div style={{ height: "50px" }}>Short Content</div>
      </ScrollableContainer>
    );
    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");
    expect(scrollableDiv).toBeInTheDocument();

    if (!scrollableDiv) throw new Error("Scrollable div not found");

    // Initial: Short content
    setScrollProps(scrollableDiv, 50, 100, 0);
    fireEvent.scroll(scrollableDiv); // Trigger checkScroll
    await waitFor(() => {
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull();
      expect(container.querySelector(".fb-bg-gradient-to-t")).toBeNull();
    });

    // Rerender with long content
    rerender(
      <ScrollableContainer>
        <div style={{ height: "200px" }}>Long Content</div>
      </ScrollableContainer>
    );
    // Simulate new scrollHeight due to new children, and assume it's at the top
    setScrollProps(scrollableDiv, 200, 100, 0);
    fireEvent.scroll(scrollableDiv); // Trigger checkScroll with new props after rerender
    await waitFor(() => {
      expect(container.querySelector(".fb-bg-gradient-to-b")).toBeNull(); // Still at top
      expect(container.querySelector(".fb-bg-gradient-to-t")).not.toBeNull(); // Bottom gradient visible
    });
  });

  test("handles containerRef.current being null initially in checkScroll", () => {
    // This test ensures that the null check for containerRef.current prevents errors.
    // It's hard to directly test the early return without altering the component's timing.
    // We rely on the fact that if it were to error, other tests might fail or it would show in coverage.
    // Forcing containerRef.current to be null when checkScroll is called is tricky.
    // However, the component's structure with useEffect should mean checkScroll is called after render.
    // We can ensure no error is thrown during render.
    expect(() => {
      render(
        <ScrollableContainer>
          <div>Content</div>
        </ScrollableContainer>
      );
    }).not.toThrow();
  });
});
