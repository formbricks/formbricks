import { beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { trackAction, trackCodeAction, trackNoCodeAction } from "@/lib/survey/action";
import { SurveyStore } from "@/lib/survey/store";
import { triggerSurvey } from "@/lib/survey/widget";

vi.mock("@/lib/common/config", () => ({
  Config: {
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

vi.mock("@/lib/survey/widget", () => ({
  triggerSurvey: vi.fn(),
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

  const mockConfig = {
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

    const getInstanceRn = vi.spyOn(Config, "getInstance");
    const getInstanceSurveyStore = vi.spyOn(SurveyStore, "getInstance");
    const getInstanceLogger = vi.spyOn(Logger, "getInstance");

    // Mock instances
    getInstanceRn.mockReturnValue(mockConfig as unknown as Config);
    getInstanceSurveyStore.mockReturnValue(mockSurveyStore as unknown as SurveyStore);
    getInstanceLogger.mockReturnValue(mockLogger as unknown as Logger);
  });

  describe("trackAction", () => {
    test("logs debug message with action name", async () => {
      mockConfig.get.mockReturnValue({ filteredSurveys: [] });

      const result = await trackAction("testAction");

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Formbricks: Action "testAction" tracked');
    });

    test("logs debug message with alias if provided", async () => {
      mockConfig.get.mockReturnValue({ filteredSurveys: [] });

      const result = await trackAction("testAction", "aliasName");

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Formbricks: Action "aliasName" tracked');
    });

    test("triggers survey if action matches survey trigger", async () => {
      mockConfig.get.mockReturnValue({
        filteredSurveys: [mockSurvey],
      });

      const result = await trackAction("testAction");

      expect(result.ok).toBe(true);
      expect(triggerSurvey).toHaveBeenCalledWith(mockSurvey, "testAction");
    });

    test("handles multiple matching surveys", async () => {
      const mockSurveys = [
        {
          id: "survey_1",
          triggers: [{ actionClass: { name: "testAction" } }],
        },
        {
          id: "survey_2",
          triggers: [{ actionClass: { name: "testAction" } }],
        },
      ];

      mockConfig.get.mockReturnValue({
        filteredSurveys: mockSurveys,
      });

      const result = await trackAction("testAction");

      expect(result.ok).toBe(true);
      expect(triggerSurvey).toHaveBeenCalledTimes(2);
    });

    test("logs when no active surveys", async () => {
      mockConfig.get.mockReturnValue({ filteredSurveys: [] });

      const result = await trackAction("testAction");

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith("No active surveys to display");
    });
  });

  describe("trackCodeAction", () => {
    test("returns error for unknown action code", async () => {
      mockConfig.get.mockReturnValue({
        environment: {
          data: {
            actionClasses: [{ type: "code", key: "known_code", name: "Known Action" }],
          },
        },
      });

      const result = await trackCodeAction("unknown_code");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_code");
        expect(result.error.message).toContain("unknown_code action unknown");
      }
    });

    test("tracks action when code is valid", async () => {
      const actionClass = { type: "code", key: "valid_code", name: "Valid Action" };

      mockConfig.get.mockReturnValue({
        environment: {
          data: {
            actionClasses: [actionClass],
          },
        },
      });

      mockConfig.get.mockReturnValue({
        environment: {
          data: {
            actionClasses: [actionClass],
          },
        },
        filteredSurveys: [],
      });

      const result = await trackCodeAction("valid_code");

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Formbricks: Action "valid_code" tracked');
    });
  });

  describe("trackNoCodeAction", () => {
    test("calls trackAction with provided name", async () => {
      mockConfig.get.mockReturnValue({ filteredSurveys: [] });

      const result = await trackNoCodeAction("noCodeAction");

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Formbricks: Action "noCodeAction" tracked');
    });
  });
});
