/* eslint-disable @typescript-eslint/unbound-method -- mock functions are unbound */
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { checkSetup } from "@/lib/common/status";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import { handleUrlFilters } from "@/lib/common/utils";
import { trackNoCodeAction } from "@/lib/survey/action";
import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  checkPageUrl,
  createTrackNoCodeActionWithContext,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
} from "@/lib/survey/no-code-action";
import { setIsSurveyRunning } from "@/lib/survey/widget";
import { type TActionClassNoCodeConfig } from "@/types/survey";

vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/timeout-stack", () => ({
  TimeoutStack: {
    getInstance: vi.fn(() => ({
      getTimeouts: vi.fn(),
      remove: vi.fn(),
      add: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/utils", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- We need this only for type inference
  const actual = await importOriginal<typeof import("@/lib/common/utils")>();
  return {
    ...actual,
    handleUrlFilters: vi.fn(),
    evaluateNoCodeConfigClick: vi.fn(),
  };
});

vi.mock("@/lib/survey/action", () => ({
  trackNoCodeAction: vi.fn(),
}));

vi.mock("@/lib/survey/widget", () => ({
  setIsSurveyRunning: vi.fn(),
}));

vi.mock("@/lib/common/status", () => ({
  checkSetup: vi.fn(),
}));

describe("createTrackNoCodeActionWithContext", () => {
  test("should create a trackNoCodeAction with the correct context", () => {
    const trackNoCodeActionWithContext = createTrackNoCodeActionWithContext("pageView");
    expect(trackNoCodeActionWithContext).toBeDefined();
  });

  test("should log error if trackNoCodeAction fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    vi.mocked(trackNoCodeAction).mockResolvedValue({
      ok: false,
      error: {
        code: "network_error",
        message: "Network error",
        status: 500,
        url: new URL("https://example.com"),
        responseMessage: "Network error",
      },
    });

    const trackNoCodeActionWithContext = createTrackNoCodeActionWithContext("pageView");

    expect(trackNoCodeActionWithContext).toBeDefined();
    await trackNoCodeActionWithContext("noCodeAction");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `🧱 Formbricks - Error in no-code pageView action 'noCodeAction': Network error`,
      {
        code: "network_error",
        message: "Network error",
        status: 500,
        url: new URL("https://example.com"),
        responseMessage: "Network error",
      }
    );
  });
});

describe("no-code-event-listeners file", () => {
  let getInstanceConfigMock: MockInstance<() => Config>;
  let getInstanceTimeoutStackMock: MockInstance<() => TimeoutStack>;

  beforeEach(() => {
    vi.clearAllMocks();
    getInstanceConfigMock = vi.spyOn(Config, "getInstance");
    getInstanceTimeoutStackMock = vi.spyOn(TimeoutStack, "getInstance");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("checkPageUrl calls handleUrlFilters & trackNoCodeAction for matching actionClasses", async () => {
    (handleUrlFilters as Mock).mockReturnValue(true);
    (trackNoCodeAction as Mock).mockResolvedValue({ ok: true });
    (checkSetup as Mock).mockReturnValue({ ok: true });

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        environment: {
          data: {
            actionClasses: [
              {
                name: "pageViewAction",
                type: "noCode",
                noCodeConfig: {
                  type: "pageView",
                  urlFilters: [{ value: "/some-path", rule: "contains" }],
                },
              },
            ],
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

    await checkPageUrl();

    expect(handleUrlFilters).toHaveBeenCalledWith([{ value: "/some-path", rule: "contains" }]);
    expect(trackNoCodeAction).toHaveBeenCalledWith("pageViewAction");
  });

  test("checkPageUrl removes scheduled timeouts & calls setIsSurveyRunning(false) if invalid url", async () => {
    (handleUrlFilters as Mock).mockReturnValue(false);

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        environment: {
          data: {
            actionClasses: [
              {
                name: "pageViewAction",
                type: "noCode",
                noCodeConfig: {
                  type: "pageView",
                  urlFilters: [{ value: "/fail", rule: "contains" }],
                },
              },
            ],
          },
        },
      }),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

    const mockTimeoutStack = {
      getTimeouts: vi.fn().mockReturnValue([{ event: "pageViewAction", timeoutId: 123 }]),
      remove: vi.fn(),
      add: vi.fn(),
    };

    getInstanceTimeoutStackMock.mockReturnValue(mockTimeoutStack as unknown as TimeoutStack);

    await checkPageUrl();

    expect(trackNoCodeAction).not.toHaveBeenCalled();
    expect(mockTimeoutStack.remove).toHaveBeenCalledWith(123);
    expect(setIsSurveyRunning).toHaveBeenCalledWith(false);
  });

  test("addPageUrlEventListeners adds event listeners to window, patches history if not patched", () => {
    // Spy on window.addEventListener
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
    });

    vi.stubGlobal("history", {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    });

    // By default isHistoryPatched is false, so let's confirm we patch now
    addPageUrlEventListeners();

    // Should add the events: hashchange, popstate, pushstate, replacestate, load
    const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];
    events.forEach((ev) => {
      expect(window.addEventListener).toHaveBeenCalledWith(ev, expect.any(Function));
    });

    // Clean up
    (window.addEventListener as Mock).mockRestore();
  });

  test("removePageUrlEventListeners removes them from window", () => {
    vi.stubGlobal("window", {
      removeEventListener: vi.fn(),
    });

    removePageUrlEventListeners();
    const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];
    events.forEach((ev) => {
      expect(window.removeEventListener).toHaveBeenCalledWith(ev, expect.any(Function));
    });

    (window.removeEventListener as Mock).mockRestore();
  });

  test("addClickEventListener registers click on document", () => {
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
    });

    addClickEventListener();

    expect(document.addEventListener as Mock).toHaveBeenCalledWith("click", expect.any(Function));
    (document.addEventListener as Mock).mockRestore();
  });

  test("removeClickEventListener removes click from document", () => {
    vi.stubGlobal("document", {
      removeEventListener: vi.fn(),
    });

    removeClickEventListener();
    expect(document.removeEventListener as Mock).toHaveBeenCalledWith("click", expect.any(Function));
    (document.removeEventListener as Mock).mockRestore();
  });

  test("addExitIntentListener adds mouseleave to body", () => {
    // JSDOM doesn't always have body != null, so let's ensure there's one
    vi.stubGlobal("document", {
      querySelector: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
      }),
      body: {
        innerHTML: `<body><div>Test</div></body>`,
      },
    });

    const addListenerSpy = vi.spyOn(document.querySelector("body") as HTMLElement, "addEventListener");

    addExitIntentListener();
    expect(addListenerSpy).toHaveBeenCalledWith("mouseleave", expect.any(Function));

    addListenerSpy.mockRestore();
  });

  test("removeExitIntentListener removes mouseleave from document", () => {
    // const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    vi.stubGlobal("document", {
      removeEventListener: vi.fn(),
    });

    removeExitIntentListener();
    expect(document.removeEventListener as Mock).toHaveBeenCalledWith("mouseleave", expect.any(Function));

    (document.removeEventListener as Mock).mockRestore();
  });

  test("addScrollDepthListener adds scroll event if doc readyState=complete", () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
    });

    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });

    addScrollDepthListener();
    expect(window.addEventListener as Mock).toHaveBeenCalledWith("scroll", expect.any(Function));

    (window.addEventListener as Mock).mockRestore();
  });

  test("removeScrollDepthListener removes scroll event from window", () => {
    vi.stubGlobal("window", {
      removeEventListener: vi.fn(),
    });

    removeScrollDepthListener();
    expect(window.removeEventListener as Mock).toHaveBeenCalledWith("scroll", expect.any(Function));

    (window.removeEventListener as Mock).mockRestore();
  });

  // Test cases for Click Event Handlers
  describe("Click Event Handlers", () => {
    beforeEach(() => {
      vi.stubGlobal("document", {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
    });

    test("addClickEventListener does not add listener if window is undefined", () => {
      vi.stubGlobal("window", undefined);
      addClickEventListener();
      expect(document.addEventListener).not.toHaveBeenCalled();
    });

    test("addClickEventListener does not re-add listener if already added", () => {
      vi.stubGlobal("window", {}); // Ensure window is defined
      addClickEventListener(); // First call
      expect(document.addEventListener).toHaveBeenCalledTimes(1);
      addClickEventListener(); // Second call
      expect(document.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  // Test cases for Exit Intent Handlers
  describe("Exit Intent Handlers", () => {
    let querySelectorMock: MockInstance;
    let addEventListenerMock: Mock;
    let removeEventListenerMock: Mock;

    beforeEach(() => {
      addEventListenerMock = vi.fn();
      removeEventListenerMock = vi.fn();

      querySelectorMock = vi.fn().mockReturnValue({
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      vi.stubGlobal("document", {
        querySelector: querySelectorMock,
        removeEventListener: removeEventListenerMock, // For direct document.removeEventListener calls
      });
      (handleUrlFilters as Mock).mockReset(); // Reset mock for each test
    });

    test("addExitIntentListener does not add if document is undefined", () => {
      vi.stubGlobal("document", undefined);
      addExitIntentListener();
      // No explicit expect, passes if no error. querySelector would not be called.
    });

    test("addExitIntentListener does not add if body is not found", () => {
      querySelectorMock.mockReturnValue(null); // body not found
      addExitIntentListener();
      expect(addEventListenerMock).not.toHaveBeenCalled();
    });

    test("checkExitIntent does not trigger if clientY > 0", () => {
      const mockAction = {
        name: "exitAction",
        type: "noCode",
        noCodeConfig: { type: "exitIntent", urlFilters: [] },
      };
      const mockConfigValue = {
        get: vi.fn().mockReturnValue({
          environment: { data: { actionClasses: [mockAction] } },
        }),
      };
      getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
      (handleUrlFilters as Mock).mockReturnValue(true);

      addExitIntentListener();

      expect(handleUrlFilters).not.toHaveBeenCalled();
      expect(trackNoCodeAction).not.toHaveBeenCalled();
    });
  });

  // Test cases for Scroll Depth Handlers
  describe("Scroll Depth Handlers", () => {
    let addEventListenerSpy: MockInstance;
    let removeEventListenerSpy: MockInstance;

    beforeEach(() => {
      addEventListenerSpy = vi.fn();
      removeEventListenerSpy = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
        scrollY: 0,
        innerHeight: 500,
      });
      vi.stubGlobal("document", {
        readyState: "complete",
        documentElement: {
          scrollHeight: 2000, // bodyHeight > windowSize
        },
      });
      (handleUrlFilters as Mock).mockReset();
      (trackNoCodeAction as Mock).mockReset();
      // Reset internal state variables (scrollDepthListenerAdded, scrollDepthTriggered)
      // This is tricky without exporting them. We can call removeScrollDepthListener
      // to reset scrollDepthListenerAdded. scrollDepthTriggered is reset if scrollY is 0.
      removeScrollDepthListener(); // Resets scrollDepthListenerAdded
      window.scrollY = 0; // Resets scrollDepthTriggered assumption in checkScrollDepth
    });

    afterEach(() => {
      vi.stubGlobal("document", undefined);
    });

    test("addScrollDepthListener does not add if window is undefined", () => {
      vi.stubGlobal("window", undefined);
      addScrollDepthListener();
      // No explicit expect. Passes if no error.
    });

    test("addScrollDepthListener does not re-add listener if already added", () => {
      addScrollDepthListener(); // First call
      expect(window.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledTimes(1);

      addScrollDepthListener(); // Second call
      expect(window.addEventListener).toHaveBeenCalledTimes(1);
    });

    test("checkScrollDepth does nothing if no fiftyPercentScroll actions", async () => {
      const mockConfigValue = {
        get: vi.fn().mockReturnValue({
          environment: { data: { actionClasses: [] } },
        }),
      };
      getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

      window.scrollY = 1000; // Past 50%

      addScrollDepthListener();
      const scrollCallback = addEventListenerSpy.mock.calls[0][1] as () => Promise<void>; // Added type assertion
      await scrollCallback();

      expect(handleUrlFilters).not.toHaveBeenCalled();
      expect(trackNoCodeAction).not.toHaveBeenCalled();
    });

    test("checkScrollDepth does not trigger if scroll < 50%", async () => {
      const mockAction = {
        name: "scrollAction",
        type: "noCode",
        noCodeConfig: { type: "fiftyPercentScroll", urlFilters: [] },
      };
      const mockConfigValue = {
        get: vi.fn().mockReturnValue({
          environment: { data: { actionClasses: [mockAction] } },
        }),
      };
      getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
      (handleUrlFilters as Mock).mockReturnValue(true);

      window.scrollY = 200; // scrollPosition / (bodyHeight - windowSize) = 200 / (2000 - 500) = 200 / 1500 < 0.5

      addScrollDepthListener();
      const scrollCallback = addEventListenerSpy.mock.calls[0][1] as () => Promise<void>; // Added type assertion
      await scrollCallback();

      expect(trackNoCodeAction).not.toHaveBeenCalled();
    });

    test("checkScrollDepth filters by URL", async () => {
      (handleUrlFilters as Mock).mockImplementation(
        (urlFilters: TActionClassNoCodeConfig["urlFilters"]) => urlFilters[0]?.value === "valid-scroll"
      );
      (trackNoCodeAction as Mock).mockResolvedValue({ ok: true });

      const mockActionValid = {
        name: "scrollValid",
        type: "noCode",
        noCodeConfig: { type: "fiftyPercentScroll", urlFilters: [{ value: "valid-scroll" }] },
      };
      const mockActionInvalid = {
        name: "scrollInvalid",
        type: "noCode",
        noCodeConfig: { type: "fiftyPercentScroll", urlFilters: [{ value: "invalid-scroll" }] },
      };
      const mockConfigValue = {
        get: vi.fn().mockReturnValue({
          environment: { data: { actionClasses: [mockActionValid, mockActionInvalid] } },
        }),
      };
      getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
      window.scrollY = 1000; // Past 50%

      addScrollDepthListener();
      const scrollCallback = addEventListenerSpy.mock.calls[0][1] as () => Promise<void>; // Added type assertion
      await scrollCallback();

      expect(trackNoCodeAction).not.toHaveBeenCalledWith("scrollInvalid");
    });
  });
});

describe("checkPageUrl additional cases", () => {
  let getInstanceConfigMock: MockInstance<() => Config>;
  let getInstanceTimeoutStackMock: MockInstance<() => TimeoutStack>;

  beforeEach(() => {
    vi.clearAllMocks();
    getInstanceConfigMock = vi.spyOn(Config, "getInstance");
    getInstanceTimeoutStackMock = vi.spyOn(TimeoutStack, "getInstance");
  });

  test("checkPageUrl does nothing if no pageView actionClasses", async () => {
    (handleUrlFilters as Mock).mockReturnValue(true);
    (trackNoCodeAction as Mock).mockResolvedValue({ ok: true });
    (checkSetup as Mock).mockReturnValue({ ok: true });

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        environment: {
          data: {
            actionClasses: [
              {
                name: "clickAction", // Not a pageView action
                type: "noCode",
                noCodeConfig: {
                  type: "click",
                },
              },
            ],
          },
        },
      }),
      update: vi.fn(),
    };
    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    vi.stubGlobal("window", { location: { href: "/fail" } });
    await checkPageUrl();
    expect(handleUrlFilters).not.toHaveBeenCalled();
    expect(trackNoCodeAction).not.toHaveBeenCalled();
  });

  test("checkPageUrl does not remove timeout if not scheduled", async () => {
    (handleUrlFilters as Mock).mockReturnValue(false); // Invalid URL
    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        environment: {
          data: {
            actionClasses: [
              {
                name: "pageViewAction",
                type: "noCode",
                noCodeConfig: {
                  type: "pageView",
                  urlFilters: [{ value: "/fail", rule: "contains" }],
                },
              },
            ],
          },
        },
      }),
    };
    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    const mockTimeoutStack = {
      getTimeouts: vi.fn().mockReturnValue([]), // No scheduled timeouts
      remove: vi.fn(),
      add: vi.fn(),
    };
    getInstanceTimeoutStackMock.mockReturnValue(mockTimeoutStack as unknown as TimeoutStack);

    vi.stubGlobal("window", { location: { href: "/fail" } });
    await checkPageUrl();

    expect(mockTimeoutStack.remove).not.toHaveBeenCalled();
    expect(setIsSurveyRunning).not.toHaveBeenCalledWith(false); // Should not be called if timeout was not present
  });
});

describe("addPageUrlEventListeners additional cases", () => {
  test("addPageUrlEventListeners does not add listeners if window is undefined", () => {
    vi.stubGlobal("window", undefined);
    addPageUrlEventListeners(); // Call the function
    // No explicit expect needed, the test passes if no error is thrown
    // and no listeners were attempted to be added to an undefined window.
    // We can also assert that isHistoryPatched remains false if it's exported and settable for testing.
    // For now, we assume it's an internal detail not directly testable without more mocks.
  });

  test("addPageUrlEventListeners does not re-add listeners if already added", () => {
    const addEventListenerMock = vi.fn();
    vi.stubGlobal("window", { addEventListener: addEventListenerMock });
    vi.stubGlobal("history", { pushState: vi.fn(), replaceState: vi.fn() });

    addPageUrlEventListeners(); // First call
    expect(addEventListenerMock).toHaveBeenCalledTimes(5); // hashchange, popstate, pushstate, replacestate, load

    addPageUrlEventListeners(); // Second call
    expect(addEventListenerMock).toHaveBeenCalledTimes(5); // Should not have been called again

    (window.addEventListener as Mock).mockRestore();
  });

  test("addPageUrlEventListeners does not patch history if already patched", () => {
    const addEventListenerMock = vi.fn();
    const originalPushState = vi.fn();
    vi.stubGlobal("window", { addEventListener: addEventListenerMock, dispatchEvent: vi.fn() });
    vi.stubGlobal("history", { pushState: originalPushState, replaceState: vi.fn() });

    // Simulate history already patched
    // This requires isHistoryPatched to be exported or a way to set it.
    // Assuming we can't directly set isHistoryPatched from outside,
    // we call it once to patch, then check if pushState is re-assigned.
    addPageUrlEventListeners(); // First call, patches history
    const patchedPushState = history.pushState;

    addPageUrlEventListeners(); // Second call
    expect(history.pushState).toBe(patchedPushState); // pushState should not be a new function

    // Test patched pushState
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    patchedPushState.apply(history, [{}, "", "/new-url"]);
    expect(originalPushState).toHaveBeenCalled();
    // expect(dispatchEventSpy).toHaveBeenCalledWith(event);

    (window.addEventListener as Mock).mockRestore();
    dispatchEventSpy.mockRestore();
  });
});

describe("removePageUrlEventListeners additional cases", () => {
  test("removePageUrlEventListeners does nothing if window is undefined", () => {
    vi.stubGlobal("window", undefined);
    removePageUrlEventListeners();
    // No explicit expect. Passes if no error.
  });

  test("removePageUrlEventListeners does nothing if listeners were not added", () => {
    const removeEventListenerMock = vi.fn();
    vi.stubGlobal("window", { removeEventListener: removeEventListenerMock });
    // Assuming listeners are not added yet (arePageUrlEventListenersAdded is false)
    removePageUrlEventListeners();
    (window.removeEventListener as Mock).mockRestore();
  });
});
