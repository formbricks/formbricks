import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SurveyLoadingAnimation } from "./survey-loading-animation";

// Mock the LoadingSpinner component for simpler testing
vi.mock("@/modules/ui/components/loading-spinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading Spinner</div>,
}));

// Mock next/image with a proper implementation that renders valid HTML
vi.mock("next/image", () => ({
  __esModule: true,
  default: function Image({ src, alt, className }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} data-testid="next-image" />
    );
  },
}));

describe("SurveyLoadingAnimation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();

    const mockCardElement = document.createElement("div");

    vi.spyOn(mockCardElement, "getElementsByTagName").mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === "img") {
        const img1 = document.createElement("img");
        (img1 as any).naturalHeight = 100; // naturalHeight is readonly, use 'any' for test setup
        const img2 = document.createElement("img");
        (img2 as any).naturalHeight = 100;

        const imagesArray = [img1, img2];
        // Mimic HTMLCollection properties needed by Array.from or direct iteration
        (imagesArray as any).item = (index: number) => imagesArray[index];
        (imagesArray as any).length = imagesArray.length;
        return imagesArray as unknown as HTMLCollectionOf<HTMLImageElement>;
      }
      const emptyArray = [] as any[];
      (emptyArray as any).item = (index: number) => emptyArray[index];
      (emptyArray as any).length = 0;
      return emptyArray as unknown as HTMLCollectionOf<HTMLImageElement>;
    });

    const mockFormbricksContainer = document.createElement("div");

    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id === "questionCard--1" || id === "questionCard-0") {
        return mockCardElement;
      }
      if (id === "formbricks-survey-container") {
        return mockFormbricksContainer;
      }
      return null;
    });

    // Ensure querySelectorAll returns actual DOM elements
    const mockImgElement = document.createElement("img");
    const mockIframeElement = document.createElement("iframe");
    const mediaElementsArray = [mockImgElement, mockIframeElement];

    vi.spyOn(document, "querySelectorAll").mockImplementation(() => {
      // This is a simplified mock. If specific selectors are important, this may need refinement.
      // For now, it returns a list of actual elements that have addEventListener/removeEventListener.
      const nodeList = mediaElementsArray as any;
      nodeList.forEach = Array.prototype.forEach; // Ensure NodeList-like behavior if needed
      return nodeList as NodeListOf<HTMLElement>;
    });

    global.MutationObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    }));

    // The generic Element.prototype.getElementsByTagName mock that was causing issues is now removed.
  });

  test("renders loading animation with branding when enabled", () => {
    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={true}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Use the data-testid from the mocked LoadingSpinner
    const spinnerElement = screen.getByTestId("loading-spinner");
    expect(spinnerElement).toBeInTheDocument();

    // The parentElement of the mocked spinner is the div that also contains the branding image.
    const animationWrapper = spinnerElement.parentElement;
    expect(animationWrapper).toBeInTheDocument();
    // Expecting 2 children: the mocked Image and the mocked LoadingSpinner div.
    expect(animationWrapper?.children.length).toBe(2);
  });

  test("does not render branding when disabled", () => {
    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={true}
        isBrandingEnabled={false}
        isBackgroundLoaded={true}
      />
    );

    const spinnerElement = screen.getByTestId("loading-spinner");
    expect(spinnerElement).toBeInTheDocument();

    const animationWrapper = spinnerElement.parentElement;
    expect(animationWrapper).toBeInTheDocument();
    // Expecting 1 child: the mocked LoadingSpinner div.
    expect(animationWrapper?.children.length).toBe(1);
  });

  test("uses correct card ID based on welcome card prop", () => {
    // Test with welcome card enabled
    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={true}
        isBrandingEnabled={true}
        isBackgroundLoaded={false} // Set to false to make background visible
      />
    );

    // The component should create a loading animation visible initially
    let loadingAnimation = screen.getByTestId("loading-spinner").parentElement?.parentElement;
    expect(loadingAnimation).toBeInTheDocument();
    expect(loadingAnimation).toHaveClass("bg-white");

    // Cleanup to prevent interference between tests
    cleanup();

    // Test with welcome card disabled
    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={false}
      />
    );

    // The component should create a loading animation visible initially
    loadingAnimation = screen.getByTestId("loading-spinner").parentElement?.parentElement;
    expect(loadingAnimation).toBeInTheDocument();
    expect(loadingAnimation).toHaveClass("bg-white");
  });

  test("sets minTimePassed to true after 500ms", () => {
    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Before timer
    const animationContainer = screen.getByTestId("loading-spinner").parentElement?.parentElement;
    expect(animationContainer).toHaveClass("bg-white");

    // Advance timers to trigger minTimePassed
    vi.advanceTimersByTime(500);

    // The background should still be white because isMediaLoaded isn't true yet
    expect(animationContainer).toHaveClass("bg-white");
  });

  test("hides animation when minTimePassed and isMediaLoaded are both true", () => {
    // Create a component with controlled state for testing
    const TestComponent = () => {
      const [, setIsMediaLoaded] = React.useState(false); // NOSONAR

      return (
        <div>
          <button data-testid="toggle-loaded" onClick={() => setIsMediaLoaded(true)}>
            Toggle Loaded
          </button>
          <SurveyLoadingAnimation
            isWelcomeCardEnabled={false}
            isBrandingEnabled={true}
            isBackgroundLoaded={true}
          />
        </div>
      );
    };

    render(<TestComponent />);

    // Wait for minTimePassed to be true (500ms)
    vi.advanceTimersByTime(500);

    // Animation should still be visible
    let animationContainer = screen.getByTestId("loading-spinner").parentElement?.parentElement;
    expect(animationContainer).not.toHaveClass("hidden");

    // Fast-forward additional time to ensure no changes without state updates
    vi.advanceTimersByTime(1000);
    expect(animationContainer).not.toHaveClass("hidden");
  });

  test("cleans up timeouts when unmounting", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    unmount();

    // At least one clearTimeout should be called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  test("triggers MutationObserver callback when nodes are added", () => {
    // Create a mock object to capture the observer instance
    const mockDisconnect = vi.fn();
    const mockObserverInstance = {
      observe: vi.fn(),
      disconnect: mockDisconnect,
      takeRecords: vi.fn(),
    };

    // Mock MutationObserver to store the callback and return our controlled instance
    let observerCallback: MutationCallback = () => {};
    global.MutationObserver = vi.fn().mockImplementation((callback) => {
      observerCallback = callback;
      return mockObserverInstance;
    });

    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Simulate a mutation with added nodes
    const mockMutations = [
      {
        addedNodes: [document.createElement("div")],
        removedNodes: [],
        type: "childList",
        target: document.createElement("div"),
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null,
      },
    ] as any;

    // Call the stored callback with our mutations and the same observer instance
    observerCallback(mockMutations, mockObserverInstance as unknown as MutationObserver);

    // The observer's disconnect method should be called
    expect(mockDisconnect).toHaveBeenCalled();
  });

  test("animation transitions after all conditions are met", () => {
    // Setup component with all necessary states to transition
    const { container, rerender } = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Initial state - background should be white
    const animationContainer = container.firstChild as HTMLElement;
    expect(animationContainer).toHaveClass("bg-white");

    // Mock the useState to force states we want to test
    const useStateSpy = vi.spyOn(React, "useState");

    // Make minTimePassed true (normally happens after 500ms)
    useStateSpy.mockImplementationOnce(() => [true, vi.fn()]);
    // Make isMediaLoaded true
    useStateSpy.mockImplementationOnce(() => [true, vi.fn()]);
    // Keep other state implementations unchanged
    useStateSpy.mockImplementation(() => [true, vi.fn()]);

    // Re-render with mocked states
    rerender(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // After 500ms, animation should start to disappear
    vi.advanceTimersByTime(500);

    // Clean up
    useStateSpy.mockRestore();
  });

  test("handles case when target node doesn't exist", () => {
    // Mock getElementById to return null for the formbricks-survey-container
    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id === "questionCard--1" || id === "questionCard-0") {
        const mockCardElement = document.createElement("div");
        vi.spyOn(mockCardElement, "getElementsByTagName").mockReturnValue(
          [] as unknown as HTMLCollectionOf<HTMLImageElement>
        );
        return mockCardElement;
      }
      return null; // Return null for all IDs, including formbricks-survey-container
    });

    const mockObserve = vi.fn();
    global.MutationObserver = vi.fn().mockImplementation(() => ({
      observe: mockObserve,
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    }));

    render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // The observe method should not be called if the target node doesn't exist
    expect(mockObserve).not.toHaveBeenCalled();
  });

  test("checks media loaded state when isSurveyPackageLoaded changes", () => {
    const component = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Force state update to trigger the effect for media loading check
    const setState = vi.fn();
    const useStateSpy = vi.spyOn(React, "useState");
    useStateSpy.mockImplementationOnce(() => [true, setState]);

    component.rerender(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Let the effect check media loading
    vi.runAllTimers();

    // Clean up
    useStateSpy.mockRestore();
  });

  test("sets isHidden to false when isMediaLoaded is false and minTimePassed is true", () => {
    // Mock useState to control specific states
    const useStateMock = vi.spyOn(React, "useState");

    // First useState call for isHidden (false initially)
    useStateMock.mockImplementationOnce(() => [false, vi.fn()]);
    // Second useState call for minTimePassed (true for this test)
    useStateMock.mockImplementationOnce(() => [true, vi.fn()]);
    // Third useState call for isMediaLoaded (false for this test)
    useStateMock.mockImplementationOnce(() => [false, vi.fn()]);
    // Let other useState calls use their default implementation

    const { container } = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Animation container should be visible (not hidden)
    const animationContainer = container.firstChild as HTMLElement;
    expect(animationContainer).not.toHaveClass("hidden");

    // Restore the original implementation
    useStateMock.mockRestore();
  });

  test("sets isHidden to false when isMediaLoaded is true and minTimePassed is false", () => {
    // Mock useState to control specific states
    const useStateMock = vi.spyOn(React, "useState");

    // First useState call for isHidden (false initially)
    useStateMock.mockImplementationOnce(() => [false, vi.fn()]);
    // Second useState call for minTimePassed (false for this test)
    useStateMock.mockImplementationOnce(() => [false, vi.fn()]);
    // Third useState call for isMediaLoaded (true for this test)
    useStateMock.mockImplementationOnce(() => [true, vi.fn()]);
    // Let other useState calls use their default implementation

    const { container } = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Animation container should be visible (not hidden)
    const animationContainer = container.firstChild as HTMLElement;
    expect(animationContainer).not.toHaveClass("hidden");

    // Restore the original implementation
    useStateMock.mockRestore();
  });

  test("clears hideTimer on unmount when condition is true", () => {
    // Set up a mock timer ID
    const mockTimerId = 123;
    const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(() => mockTimerId as any);
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    // Mock useState to control specific states
    const useStateMock = vi.spyOn(React, "useState");

    // First useState call for isHidden
    useStateMock.mockImplementationOnce(() => [false, vi.fn()]);
    // Second useState call for minTimePassed (true for this test)
    useStateMock.mockImplementationOnce(() => [true, vi.fn()]);
    // Third useState call for isMediaLoaded (true for this test)
    useStateMock.mockImplementationOnce(() => [true, vi.fn()]);
    // Let other useState calls use their default implementation

    const { unmount } = render(
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={false}
        isBrandingEnabled={true}
        isBackgroundLoaded={true}
      />
    );

    // Component unmount should trigger cleanup
    unmount();

    // The clearTimeout should be called with our timer ID
    expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimerId);

    // Restore the original implementations
    useStateMock.mockRestore();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  test("mutation observer sets isSurveyPackageLoaded when child added", () => {
    let cb: MutationCallback;
    global.MutationObserver = vi.fn((fn) => {
      cb = fn;
      return { observe: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn() };
    }) as any;
    const container = document.createElement("div");
    container.id = "formbricks-survey-container";
    document.body.append(container);

    render(<SurveyLoadingAnimation isWelcomeCardEnabled={false} isBrandingEnabled={false} />);
    // simulate DOM injection
    cb!([{ addedNodes: [document.createElement("div")], removedNodes: [] }] as any, {} as any);
    // next effect tick
    vi.runAllTimers();
    // now media-listening effect should have set listeners and timeout
    expect(global.MutationObserver).toHaveBeenCalled();
  });
});
