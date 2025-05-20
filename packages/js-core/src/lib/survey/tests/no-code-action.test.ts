/* eslint-disable @typescript-eslint/unbound-method -- mock functions are unbound */
import { Config } from "@/lib/common/config";
import { checkSetup } from "@/lib/common/setup";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import { handleUrlFilters } from "@/lib/common/utils";
import { trackNoCodeAction } from "@/lib/survey/action";
import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  checkPageUrl,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
} from "@/lib/survey/no-code-action";
import { setIsSurveyRunning } from "@/lib/survey/widget";
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

vi.mock("@/lib/common/setup", () => ({
  checkSetup: vi.fn(),
}));

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
});
