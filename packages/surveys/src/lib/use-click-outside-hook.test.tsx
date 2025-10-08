import { render } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useClickOutside } from "./use-click-outside-hook";

describe("useClickOutside", () => {
  let container: HTMLDivElement;
  let outsideElement: HTMLDivElement;

  beforeEach(() => {
    // Create container for testing
    container = document.createElement("div");
    document.body.appendChild(container);

    // Create an outside element
    outsideElement = document.createElement("div");
    outsideElement.id = "outside";
    document.body.appendChild(outsideElement);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
    document.body.removeChild(outsideElement);
    vi.clearAllMocks();
  });

  test("should call handler when clicking outside the ref element", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    render(<TestComponent />, { container });

    // Simulate mousedown and click outside
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("should not call handler when clicking inside the ref element", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    const { container: componentContainer } = render(<TestComponent />, { container });
    const insideElement = componentContainer.querySelector("#inside")!;

    // Simulate mousedown and click inside
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: insideElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: insideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("should not call handler when mousedown started inside (even if click is outside)", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    const { container: componentContainer } = render(<TestComponent />, { container });
    const insideElement = componentContainer.querySelector("#inside")!;

    // Simulate mousedown inside
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: insideElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    // But click outside
    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("should handle touch events (touchstart and click)", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    render(<TestComponent />, { container });

    // Simulate touchstart and click outside
    const touchstartEvent = new TouchEvent("touchstart", { bubbles: true });
    Object.defineProperty(touchstartEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(touchstartEvent);

    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("should not call handler when touchstart started inside", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    const { container: componentContainer } = render(<TestComponent />, { container });
    const insideElement = componentContainer.querySelector("#inside")!;

    // Simulate touchstart inside
    const touchstartEvent = new TouchEvent("touchstart", { bubbles: true });
    Object.defineProperty(touchstartEvent, "target", { value: insideElement, configurable: true });
    document.dispatchEvent(touchstartEvent);

    // Click outside
    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("should handle clicks on descendant elements", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="parent">
          <div id="child">Child</div>
        </div>
      );
    };

    const { container: componentContainer } = render(<TestComponent />, { container });
    const childElement = componentContainer.querySelector("#child")!;

    // Simulate mousedown and click on child element
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: childElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: childElement, configurable: true });
    document.dispatchEvent(clickEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  test("should clean up event listeners on unmount", () => {
    const handler = vi.fn();
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    const { unmount } = render(<TestComponent />, { container });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  test("should not call handler when ref.current is null during click", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return <div id="inside">Inside (no ref)</div>;
    };

    render(<TestComponent />, { container });

    // Simulate mousedown and click outside
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(clickEvent);

    // Handler should not be called because ref.current is null
    expect(handler).not.toHaveBeenCalled();
  });

  test("should handle case when event.target is not a Node", () => {
    const handler = vi.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);
      useClickOutside(ref, handler);
      return (
        <div ref={ref} id="inside">
          Inside
        </div>
      );
    };

    render(<TestComponent />, { container });

    // Simulate mousedown with valid target
    const mousedownEvent = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(mousedownEvent, "target", { value: outsideElement, configurable: true });
    document.dispatchEvent(mousedownEvent);

    // Simulate click with null target (edge case)
    const clickEvent = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(clickEvent, "target", { value: null, configurable: true });
    document.dispatchEvent(clickEvent);

    // Handler should be called because ref.current is valid DOM element
    // and event.target (null) is not contained in it
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
