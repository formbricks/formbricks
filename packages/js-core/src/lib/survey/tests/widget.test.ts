import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getLanguageCode, shouldDisplayBasedOnPercentage } from "@/lib/common/utils";
import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import * as widget from "@/lib/survey/widget";
import { type TEnvironmentStateSurvey } from "@/types/config";

vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
  CONTAINER_ID: "formbricks-container",
  RN_ASYNC_STORAGE_KEY: "formbricks-react-native",
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
      add: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/utils", () => ({
  filterSurveys: vi.fn(),
  getLanguageCode: vi.fn(),
  getStyling: vi.fn(),
  shouldDisplayBasedOnPercentage: vi.fn(),
  wrapThrowsAsync: vi.fn(),
  handleHiddenFields: vi.fn(),
}));

const mockUpdateQueue = {
  hasPendingWork: vi.fn().mockReturnValue(false),
  waitForPendingWork: vi.fn().mockResolvedValue(true),
};

vi.mock("@/lib/user/update-queue", () => ({
  UpdateQueue: {
    getInstance: vi.fn(() => mockUpdateQueue),
  },
}));

describe("widget-file", () => {
  let getInstanceConfigMock: MockInstance<() => Config>;
  let getInstanceLoggerMock: MockInstance<() => Logger>;

  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    configure: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    // @ts-expect-error -- cleaning up mock
    delete window.formbricksSurveys;

    getInstanceConfigMock = vi.spyOn(Config, "getInstance");
    getInstanceLoggerMock = vi.spyOn(Logger, "getInstance").mockReturnValue(mockLogger as unknown as Logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("setIsSurveyRunning toggles internal state (covered by usage in other tests)", () => {
    widget.setIsSurveyRunning(true);
  });

  test("triggerSurvey skips if shouldDisplayBasedOnPercentage returns false", async () => {
    getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
    (shouldDisplayBasedOnPercentage as Mock).mockReturnValueOnce(false);

    await widget.triggerSurvey(mockSurvey);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Survey display of "${mockSurvey.name}" skipped based on displayPercentage.`
    );
  });

  test("triggerSurvey calls renderWidget if displayPercentage is not an issue", async () => {
    (shouldDisplayBasedOnPercentage as Mock).mockReturnValueOnce(true);

    await widget.triggerSurvey(mockSurvey);

    expect(mockLogger.debug).toHaveBeenCalledWith("A survey is already running. Skipping.");
  });

  test("renderWidget sets isSurveyRunning, handles delay, loads formbricksSurveys, and calls .renderSurvey", async () => {
    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            contactId: "contact_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "en",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

    (filterSurveys as Mock).mockReturnValue([]);
    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    vi.useFakeTimers();

    await widget.renderWidget(mockSurvey);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Delaying survey "${mockSurvey.name}" by ${mockSurvey.delay.toString()} seconds.`
    );

    vi.advanceTimersByTime(mockSurvey.delay * 1000);

    expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        survey: mockSurvey,
        appUrl: "https://fake.app",
        environmentId: "env_123",
        contactId: "contact_abc",
      })
    );
    vi.useRealTimers();
  });

  test("renderWidget short-circuits if isSurveyRunning is already true", async () => {
    widget.setIsSurveyRunning(true);
    await widget.renderWidget(mockSurvey);
    expect(mockLogger.debug).toHaveBeenCalledWith("A survey is already running. Skipping.");
  });

  test("renderWidget handles multi-language and skip if no matching language", async () => {
    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "hi",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

    const mockSurveyNoDelay = {
      ...mockSurvey,
      delay: 0,
      languages: [{ language: { code: "en" } }, { language: { code: "fr" } }],
    };

    widget.setIsSurveyRunning(false);
    (getLanguageCode as Mock).mockReturnValueOnce(undefined); // means "not available"

    await widget.renderWidget(mockSurveyNoDelay as unknown as TEnvironmentStateSurvey);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Survey "${mockSurvey.name}" is not available in specified language.`
    );
  });

  test("closeSurvey removes widget container, resets filtered surveys, sets isSurveyRunning=false", () => {
    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "hi",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);

    document.body.innerHTML = `<div id="formbricks-container"></div>`;
    widget.closeSurvey();
    expect(document.getElementById("formbricks-container")).toBeFalsy();

    expect(mockConfigValue.update).toHaveBeenCalled();
  });

  test("addWidgetContainer creates #formbricks-container in DOM", () => {
    expect(document.getElementById("formbricks-container")).toBeFalsy();
    widget.addWidgetContainer();
    const el = document.getElementById("formbricks-container");
    expect(el).not.toBeNull();
  });

  test("removeWidgetContainer removes #formbricks-container if it exists", () => {
    document.body.innerHTML = `<div id="formbricks-container"></div>`;
    widget.removeWidgetContainer();
    expect(document.getElementById("formbricks-container")).toBeFalsy();
  });

  test("renderWidget waits for pending identification before rendering", async () => {
    mockUpdateQueue.hasPendingWork.mockReturnValue(true);
    mockUpdateQueue.waitForPendingWork.mockResolvedValue(true);

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            contactId: "contact_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "en",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    vi.useFakeTimers();

    await widget.renderWidget({
      ...mockSurvey,
      delay: 0,
    } as unknown as TEnvironmentStateSurvey);

    expect(mockUpdateQueue.hasPendingWork).toHaveBeenCalled();
    expect(mockUpdateQueue.waitForPendingWork).toHaveBeenCalled();

    vi.advanceTimersByTime(0);

    expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "contact_abc",
      })
    );

    vi.useRealTimers();
  });

  test("renderWidget does not wait when no identification is pending", async () => {
    mockUpdateQueue.hasPendingWork.mockReturnValue(false);

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            contactId: "contact_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "en",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    vi.useFakeTimers();

    await widget.renderWidget({
      ...mockSurvey,
      delay: 0,
    } as unknown as TEnvironmentStateSurvey);

    expect(mockUpdateQueue.hasPendingWork).toHaveBeenCalled();
    expect(mockUpdateQueue.waitForPendingWork).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("renderWidget reads contactId after identification wait completes", async () => {
    let callCount = 0;
    const mockConfigValue = {
      get: vi.fn().mockImplementation(() => {
        callCount++;
        return {
          appUrl: "https://fake.app",
          environmentId: "env_123",
          environment: {
            data: {
              project: {
                clickOutsideClose: true,
                overlay: "none",
                placement: "bottomRight",
                inAppSurveyBranding: true,
              },
            },
          },
          user: {
            data: {
              // Simulate contactId becoming available after identification
              userId: "user_abc",
              contactId: callCount > 2 ? "contact_after_identification" : undefined,
              displays: [],
              responses: [],
              lastDisplayAt: null,
              language: "en",
            },
          },
        };
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    mockUpdateQueue.hasPendingWork.mockReturnValue(true);
    mockUpdateQueue.waitForPendingWork.mockResolvedValue(true);
    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    vi.useFakeTimers();

    await widget.renderWidget({
      ...mockSurvey,
      delay: 0,
    } as unknown as TEnvironmentStateSurvey);

    vi.advanceTimersByTime(0);

    // The contactId passed to renderSurvey should be read after the wait
    expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "contact_after_identification",
      })
    );

    vi.useRealTimers();
  });

  test("renderWidget skips survey when identification fails and survey has segment filters", async () => {
    mockUpdateQueue.hasPendingWork.mockReturnValue(true);
    mockUpdateQueue.waitForPendingWork.mockResolvedValue(false);

    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    await widget.renderWidget({
      ...mockSurvey,
      delay: 0,
      segment: { id: "seg_1", filters: [{ type: "attribute", value: "plan" }] },
    } as unknown as TEnvironmentStateSurvey);

    expect(mockUpdateQueue.waitForPendingWork).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "User identification failed. Skipping survey with segment filters."
    );
    expect(window.formbricksSurveys.renderSurvey).not.toHaveBeenCalled();
  });

  describe("loadFormbricksSurveysExternally and waitForSurveysGlobal", () => {
    const scriptLoadMockConfig = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: "user_abc",
            contactId: "contact_abc",
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "en",
          },
        },
      }),
      update: vi.fn(),
    };

    // Helper to get the script element passed to document.head.appendChild
    const getAppendedScript = (): Record<string, unknown> => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- accessing mock for test assertions
      const appendChildMock = vi.mocked(document.head.appendChild);
      for (const call of appendChildMock.mock.calls) {
        const el = call[0] as unknown as Record<string, unknown>;
        if (typeof el.src === "string" && el.src.includes("surveys.umd.cjs")) {
          return el;
        }
      }
      throw new Error("No script element for surveys.umd.cjs was appended to document.head");
    };

    beforeEach(() => {
      // Reset mock return values that may have been overridden by previous tests
      mockUpdateQueue.hasPendingWork.mockReturnValue(false);
      mockUpdateQueue.waitForPendingWork.mockResolvedValue(true);
    });

    // Test onerror first so surveysLoadPromise is reset to null for subsequent tests
    test("rejects when script fails to load (onerror) and allows retry", async () => {
      getInstanceConfigMock.mockReturnValue(scriptLoadMockConfig as unknown as Config);
      widget.setIsSurveyRunning(false);

      // eslint-disable-next-line @typescript-eslint/no-empty-function -- suppress console.error in test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const renderPromise = widget.renderWidget({
        ...mockSurvey,
        delay: 0,
      } as unknown as TEnvironmentStateSurvey);

      const scriptEl = getAppendedScript();

      expect(scriptEl.src).toBe("https://fake.app/js/surveys.umd.cjs");
      expect(scriptEl.async).toBe(true);

      // Simulate network error
      (scriptEl.onerror as (error: unknown) => void)("Network error");

      await expect(renderPromise).rejects.toThrow("Failed to load Formbricks Surveys library");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load Formbricks Surveys library:", "Network error");

      consoleSpy.mockRestore();
    });

    test("rejects when script loads but surveys global never becomes available (timeout)", async () => {
      getInstanceConfigMock.mockReturnValue(scriptLoadMockConfig as unknown as Config);
      widget.setIsSurveyRunning(false);

      // eslint-disable-next-line @typescript-eslint/no-empty-function -- suppress console.error in test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.useFakeTimers();

      const renderPromise = widget.renderWidget({
        ...mockSurvey,
        delay: 0,
      } as unknown as TEnvironmentStateSurvey);

      const scriptEl = getAppendedScript();

      // Script loaded but window.formbricksSurveys is never set
      (scriptEl.onload as () => void)();

      // Attach rejection handler before advancing timers to prevent unhandled rejection
      const rejectAssert = expect(renderPromise).rejects.toThrow("Failed to load Formbricks Surveys library");

      // Advance past the 10s timeout (polls every 200ms)
      await vi.advanceTimersByTimeAsync(10001);
      await rejectAssert;

      vi.useRealTimers();
      consoleSpy.mockRestore();
    });

    test("resolves after polling when surveys global becomes available and applies stored nonce", async () => {
      getInstanceConfigMock.mockReturnValue(scriptLoadMockConfig as unknown as Config);
      widget.setIsSurveyRunning(false);

      // Set nonce before surveys load to test nonce application
      window.__formbricksNonce = "test-nonce-123";

      vi.useFakeTimers();

      const renderPromise = widget.renderWidget({
        ...mockSurvey,
        delay: 0,
      } as unknown as TEnvironmentStateSurvey);

      const scriptEl = getAppendedScript();

      // Simulate script loaded
      (scriptEl.onload as () => void)();

      // Set the global after script "loads" — simulates browser finishing execution
      // @ts-expect-error -- mock window.formbricksSurveys
      window.formbricksSurveys = { renderSurvey: vi.fn(), setNonce: vi.fn() };

      // Advance one polling interval for waitForSurveysGlobal to find it
      await vi.advanceTimersByTimeAsync(200);

      await renderPromise;

      // Run remaining timers for survey.delay setTimeout
      vi.runAllTimers();

      expect(window.formbricksSurveys.setNonce).toHaveBeenCalledWith("test-nonce-123");
      expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          appUrl: "https://fake.app",
          environmentId: "env_123",
          contactId: "contact_abc",
        })
      );

      vi.useRealTimers();
      delete window.__formbricksNonce;
    });

    test("deduplicates concurrent calls (returns cached promise)", async () => {
      getInstanceConfigMock.mockReturnValue(scriptLoadMockConfig as unknown as Config);
      widget.setIsSurveyRunning(false);

      // After the previous successful test, surveysLoadPromise holds a resolved promise.
      // Calling renderWidget again (without formbricksSurveys on window, but with cached promise)
      // should reuse the cached promise rather than creating a new script element.
      // @ts-expect-error -- cleaning up mock to force dedup path
      delete window.formbricksSurveys;

      const appendChildSpy = vi.spyOn(document.head, "appendChild");

      // @ts-expect-error -- mock window.formbricksSurveys
      window.formbricksSurveys = { renderSurvey: vi.fn(), setNonce: vi.fn() };

      vi.useFakeTimers();

      await widget.renderWidget({
        ...mockSurvey,
        delay: 0,
      } as unknown as TEnvironmentStateSurvey);

      vi.advanceTimersByTime(0);

      // No new script element should have been appended (dedup via early return or cached promise)
      const scriptAppendCalls = appendChildSpy.mock.calls.filter((call: unknown[]) => {
        const el = call[0] as Record<string, unknown> | undefined;
        return typeof el?.src === "string" && el.src.includes("surveys.umd.cjs");
      });
      expect(scriptAppendCalls.length).toBe(0);

      expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  test("preloadSurveysScript adds a preload link and deduplicates subsequent calls", () => {
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi.spyOn(document.head, "appendChild");

    widget.preloadSurveysScript("https://fake.app");

    expect(createElementSpy).toHaveBeenCalledWith("link");
    expect(appendChildSpy).toHaveBeenCalledTimes(1);

    const linkEl = createElementSpy.mock.results[0].value as Record<string, string>;
    expect(linkEl.rel).toBe("preload");
    expect(linkEl.as).toBe("script");
    expect(linkEl.href).toBe("https://fake.app/js/surveys.umd.cjs");

    // Second call should be a no-op (deduplication)
    widget.preloadSurveysScript("https://fake.app");
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
  });

  test("renderWidget proceeds when identification fails but survey has no segment filters", async () => {
    mockUpdateQueue.hasPendingWork.mockReturnValue(true);
    mockUpdateQueue.waitForPendingWork.mockResolvedValue(false);

    const mockConfigValue = {
      get: vi.fn().mockReturnValue({
        appUrl: "https://fake.app",
        environmentId: "env_123",
        environment: {
          data: {
            project: {
              clickOutsideClose: true,
              overlay: "none",
              placement: "bottomRight",
              inAppSurveyBranding: true,
            },
          },
        },
        user: {
          data: {
            userId: null,
            contactId: null,
            displays: [],
            responses: [],
            lastDisplayAt: null,
            language: "en",
          },
        },
      }),
      update: vi.fn(),
    };

    getInstanceConfigMock.mockReturnValue(mockConfigValue as unknown as Config);
    widget.setIsSurveyRunning(false);

    // @ts-expect-error -- mock window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurvey: vi.fn(),
    };

    vi.useFakeTimers();

    await widget.renderWidget({
      ...mockSurvey,
      delay: 0,
      segment: undefined,
    } as unknown as TEnvironmentStateSurvey);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "User identification failed but survey has no segment filters. Proceeding."
    );

    vi.advanceTimersByTime(0);
    expect(window.formbricksSurveys.renderSurvey).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
