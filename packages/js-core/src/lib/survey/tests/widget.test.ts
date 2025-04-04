import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getLanguageCode, shouldDisplayBasedOnPercentage } from "@/lib/common/utils";
import * as widget from "@/lib/survey/widget";
import { type TEnvironmentStateSurvey } from "@/types/config";
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
              darkOverlay: false,
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
              darkOverlay: false,
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
              darkOverlay: false,
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
});
