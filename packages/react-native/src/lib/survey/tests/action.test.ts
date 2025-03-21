import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { RNConfig } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { shouldDisplayBasedOnPercentage } from "@/lib/common/utils";
import { track, trackAction, triggerSurvey } from "@/lib/survey/action";
import { SurveyStore } from "@/lib/survey/store";
import { type TEnvironmentStateSurvey } from "@/types/config";

vi.mock("@/lib/common/config", () => ({
  RNConfig: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/survey/store", () => ({
  SurveyStore: {
    getInstance: vi.fn(() => ({
      setSurvey: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => {
      return {
        debug: vi.fn(),
      };
    }),
  },
}));

vi.mock("@/lib/common/utils", () => ({
  shouldDisplayBasedOnPercentage: vi.fn(),
}));

vi.mock("@react-native-community/netinfo", () => ({
  fetch: vi.fn(() => ({
    isConnected: true,
  })),
}));

describe("survey/action.ts", () => {
  const mockSurvey = {
    id: "survey_001",
    name: "Test Survey",
    displayPercentage: 50,
    triggers: [
      {
        actionClass: { name: "testAction" },
      },
    ],
  };

  const mockAppConfig = {
    get: vi.fn(),
  };

  const mockSurveyStore = {
    setSurvey: vi.fn(),
  };

  const mockLogger = {
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const getInstanceRn = vi.spyOn(RNConfig, "getInstance");
    const getInstanceSurveyStore = vi.spyOn(SurveyStore, "getInstance");
    const getInstanceLogger = vi.spyOn(Logger, "getInstance");

    // Mock instances
    getInstanceRn.mockReturnValue(mockAppConfig as unknown as RNConfig);
    getInstanceSurveyStore.mockReturnValue(mockSurveyStore as unknown as SurveyStore);
    getInstanceLogger.mockReturnValue(mockLogger as unknown as Logger);
  });

  describe("triggerSurvey", () => {
    test("does not trigger survey if displayPercentage criteria is not met", () => {
      const shouldDisplayBasedOnPercentageMock = vi.mocked(shouldDisplayBasedOnPercentage);
      shouldDisplayBasedOnPercentageMock.mockReturnValueOnce(false);

      triggerSurvey(mockSurvey as unknown as TEnvironmentStateSurvey);

      // Ensure survey is not set
      expect(mockSurveyStore.setSurvey).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Survey display of "Test Survey" skipped based on displayPercentage.'
      );
    });

    test("triggers survey if displayPercentage criteria is met", () => {
      // Mock `shouldDisplayBasedOnPercentage` to return true
      const shouldDisplayBasedOnPercentageMock = vi.mocked(shouldDisplayBasedOnPercentage);
      shouldDisplayBasedOnPercentageMock.mockReturnValueOnce(true);

      triggerSurvey(mockSurvey as unknown as TEnvironmentStateSurvey);

      // Ensure survey is set
      expect(mockSurveyStore.setSurvey).toHaveBeenCalledWith(mockSurvey);
    });
  });

  describe("trackAction", () => {
    const mockActiveSurveys = [mockSurvey];

    beforeEach(() => {
      mockAppConfig.get.mockReturnValue({
        filteredSurveys: mockActiveSurveys,
      });
    });

    test("triggers survey associated with action name", () => {
      (shouldDisplayBasedOnPercentage as unknown as Mock).mockReturnValue(true);

      trackAction("testAction");

      // Ensure triggerSurvey is called for the matching survey
      expect(mockSurveyStore.setSurvey).toHaveBeenCalledWith(mockSurvey);
    });

    test("does not trigger survey if no active surveys are found", () => {
      mockAppConfig.get.mockReturnValue({
        filteredSurveys: [],
      });

      trackAction("testAction");

      // Ensure no surveys are triggered
      expect(mockSurveyStore.setSurvey).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("No active surveys to display");
    });

    test("logs tracked action name", () => {
      trackAction("testAction");

      expect(mockLogger.debug).toHaveBeenCalledWith('Formbricks: Action "testAction" tracked');
    });
  });

  describe("track", () => {
    const mockActionClasses = [
      {
        key: "testCode",
        type: "code",
        name: "testAction",
      },
    ];

    beforeEach(() => {
      mockAppConfig.get.mockReturnValue({
        environment: {
          data: { actionClasses: mockActionClasses },
        },
      });
    });

    test("tracks a valid action by code", async () => {
      const result = await track("testCode");

      expect(result.ok).toBe(true);
    });

    test("returns error for invalid action code", async () => {
      const result = await track("invalidCode");

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.error.code).toBe("invalid_code");
        expect(result.error.message).toBe(
          "invalidCode action unknown. Please add this action in Formbricks first in order to use it in your code."
        );
      }
    });
  });
});
