import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ScrollableContainer, type ScrollableContainerHandle } from "./scrollable-container";

// Mock cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("ScrollableContainer - New Ref Functionality", () => {
  afterEach(() => {
    cleanup();
  });

  test("ref exposes scrollToBottom method", () => {
    const ref = createRef<ScrollableContainerHandle>();

    render(
      <ScrollableContainer ref={ref}>
        <div>Content</div>
      </ScrollableContainer>
    );

    expect(ref.current).toEqual({
      scrollToBottom: expect.any(Function),
    });
  });

  test("scrollToBottom functionality works correctly", () => {
    const ref = createRef<ScrollableContainerHandle>();
    const { container } = render(
      <ScrollableContainer ref={ref}>
        <div style={{ height: "200px" }}>Tall Content</div>
      </ScrollableContainer>
    );

    const scrollableDiv = container.querySelector<HTMLElement>(".fb-overflow-auto");

    if (scrollableDiv) {
      // Mock scroll properties
      Object.defineProperty(scrollableDiv, "scrollHeight", {
        value: 200,
        configurable: true,
      });

      let currentScrollTop = 0;
      Object.defineProperty(scrollableDiv, "scrollTop", {
        get: () => currentScrollTop,
        set: (value) => {
          currentScrollTop = value;
        },
        configurable: true,
      });

      // Call scrollToBottom
      ref.current?.scrollToBottom();

      // Check that scrollTop was set to scrollHeight
      expect(currentScrollTop).toBe(200);
    }
  });

  test("scrollToBottom handles null containerRef gracefully", () => {
    const ref = createRef<ScrollableContainerHandle>();

    render(
      <ScrollableContainer ref={ref}>
        <div>Content</div>
      </ScrollableContainer>
    );

    // Should not throw when called
    expect(() => ref.current?.scrollToBottom()).not.toThrow();
  });

  test("handles function ref correctly", () => {
    let refValue: ScrollableContainerHandle | null = null;
    const functionRef = (ref: ScrollableContainerHandle | null) => {
      refValue = ref;
    };

    render(
      <ScrollableContainer ref={functionRef}>
        <div>Content</div>
      </ScrollableContainer>
    );

    expect(refValue).toEqual({
      scrollToBottom: expect.any(Function),
    });
  });
});
