import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CRON_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { mockSurveyOutput } from "@formbricks/lib/survey/tests/__mock__/survey.mock";
import { doesSurveyHasOpenTextQuestion } from "@formbricks/lib/survey/utils";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  doesResponseHasAnyOpenTextAnswer,
  generateInsightsEnabledForSurveyQuestions,
  generateInsightsForSurvey,
} from "./utils";

// Mock all dependencies
vi.mock("@formbricks/lib/constants", () => ({
  CRON_SECRET: vi.fn(() => "mocked-cron-secret"),
  WEBAPP_URL: "https://mocked-webapp-url.com",
}));

vi.mock("@formbricks/lib/survey/cache", () => ({
  surveyCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@formbricks/lib/survey/service", () => ({
  getSurvey: vi.fn(),
  updateSurvey: vi.fn(),
}));

vi.mock("@formbricks/lib/survey/utils", () => ({
  doesSurveyHasOpenTextQuestion: vi.fn(),
}));

vi.mock("@formbricks/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Insights Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateInsightsForSurvey", () => {
    test("should call fetch with correct parameters", () => {
      const surveyId = "survey-123";
      mockFetch.mockResolvedValueOnce({ ok: true });

      generateInsightsForSurvey(surveyId);

      expect(mockFetch).toHaveBeenCalledWith(`${WEBAPP_URL}/api/insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CRON_SECRET,
        },
        body: JSON.stringify({
          surveyId,
        }),
      });
    });

    test("should handle errors and return error object", () => {
      const surveyId = "survey-123";
      mockFetch.mockImplementationOnce(() => {
        throw new Error("Network error");
      });

      const result = generateInsightsForSurvey(surveyId);

      expect(result).toEqual({
        ok: false,
        error: new Error("Error while generating insights for survey: Network error"),
      });
    });

    test("should throw error if CRON_SECRET is not set", async () => {
      // Reset modules to ensure clean state
      vi.resetModules();

      // Mock CRON_SECRET as undefined
      vi.doMock("@formbricks/lib/constants", () => ({
        CRON_SECRET: undefined,
        WEBAPP_URL: "https://mocked-webapp-url.com",
      }));

      // Re-import the utils module to get the mocked CRON_SECRET
      const { generateInsightsForSurvey } = await import("./utils");

      expect(() => generateInsightsForSurvey("survey-123")).toThrow("CRON_SECRET is not set");

      // Reset modules after test
      vi.resetModules();
    });
  });

  describe("generateInsightsEnabledForSurveyQuestions", () => {
    test("should return success=false when survey has no open text questions", async () => {
      // Mock data
      const surveyId = "survey-123";
      const mockSurvey: TSurvey = {
        ...mockSurveyOutput,
        type: "link",
        segment: null,
        displayPercentage: null,
        questions: [
          {
            id: "cm8cjnse3000009jxf20v91ic",
            type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            headline: { default: "Question 1" },
            required: true,
            choices: [
              {
                id: "cm8cjnse3000009jxf20v91ic",
                label: { default: "Choice 1" },
              },
            ],
          },
          {
            id: "cm8cjo19c000109jx6znygc0u",
            type: TSurveyQuestionTypeEnum.Rating,
            headline: { default: "Question 2" },
            required: true,
            scale: "number",
            range: 5,
            isColorCodingEnabled: false,
          },
        ],
      };

      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(mockSurvey);
      vi.mocked(doesSurveyHasOpenTextQuestion).mockReturnValueOnce(false);

      // Execute function
      const result = await generateInsightsEnabledForSurveyQuestions(surveyId);

      // Verify results
      expect(result).toEqual({ success: false });
      expect(updateSurvey).not.toHaveBeenCalled();
    });

    test("should return success=true when survey is updated with insights enabled", async () => {
      vi.clearAllMocks();
      // Mock data
      const surveyId = "cm8ckvchx000008lb710n0gdn";

      // Mock survey with open text questions that have no insightsEnabled property
      const mockSurveyWithOpenTextQuestions: TSurvey = {
        ...mockSurveyOutput,
        id: surveyId,
        type: "link",
        segment: null,
        displayPercentage: null,
        questions: [
          {
            id: "cm8cjnse3000009jxf20v91ic",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 1" },
            required: true,
            inputType: "text",
            charLimit: {},
          },
          {
            id: "cm8cjo19c000109jx6znygc0u",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 2" },
            required: true,
            inputType: "text",
            charLimit: {},
          },
        ],
      };

      // Define the updated survey that should be returned after updateSurvey
      const mockUpdatedSurveyWithOpenTextQuestions: TSurvey = {
        ...mockSurveyWithOpenTextQuestions,
        questions: mockSurveyWithOpenTextQuestions.questions.map((q) => ({
          ...q,
          insightsEnabled: true, // Updated property
        })),
      };

      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(mockSurveyWithOpenTextQuestions);
      vi.mocked(doesSurveyHasOpenTextQuestion).mockReturnValueOnce(true);
      vi.mocked(updateSurvey).mockResolvedValueOnce(mockUpdatedSurveyWithOpenTextQuestions);

      // Execute function
      const result = await generateInsightsEnabledForSurveyQuestions(surveyId);

      expect(result).toEqual({
        success: true,
        survey: mockUpdatedSurveyWithOpenTextQuestions,
      });
    });

    test("should return success=false when all open text questions already have insightsEnabled defined", async () => {
      // Mock data
      const surveyId = "survey-123";
      const mockSurvey: TSurvey = {
        ...mockSurveyOutput,
        type: "link",
        segment: null,
        displayPercentage: null,
        questions: [
          {
            id: "cm8cjnse3000009jxf20v91ic",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 1" },
            required: true,
            inputType: "text",
            charLimit: {},
            insightsEnabled: true,
          },
          {
            id: "cm8cjo19c000109jx6znygc0u",
            type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            headline: { default: "Question 2" },
            required: true,
            choices: [
              {
                id: "cm8cjnse3000009jxf20v91ic",
                label: { default: "Choice 1" },
              },
            ],
          },
        ],
      };

      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(mockSurvey);
      vi.mocked(doesSurveyHasOpenTextQuestion).mockReturnValueOnce(true);

      // Execute function
      const result = await generateInsightsEnabledForSurveyQuestions(surveyId);

      // Verify results
      expect(result).toEqual({ success: false });
      expect(updateSurvey).not.toHaveBeenCalled();
    });

    test("should throw ResourceNotFoundError if survey is not found", async () => {
      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(null);

      // Execute and verify function
      await expect(generateInsightsEnabledForSurveyQuestions("survey-123")).rejects.toThrow(
        new ResourceNotFoundError("Survey", "survey-123")
      );
    });

    test("should throw ResourceNotFoundError if updateSurvey returns null", async () => {
      // Mock data
      const surveyId = "survey-123";
      const mockSurvey: TSurvey = {
        ...mockSurveyOutput,
        type: "link",
        segment: null,
        displayPercentage: null,
        questions: [
          {
            id: "cm8cjnse3000009jxf20v91ic",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 1" },
            required: true,
            inputType: "text",
            charLimit: {},
          },
        ],
      };

      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(mockSurvey);
      vi.mocked(doesSurveyHasOpenTextQuestion).mockReturnValueOnce(true);
      // Type assertion to handle the null case
      vi.mocked(updateSurvey).mockResolvedValueOnce(null as unknown as TSurvey);

      // Execute and verify function
      await expect(generateInsightsEnabledForSurveyQuestions(surveyId)).rejects.toThrow(
        new ResourceNotFoundError("Survey", surveyId)
      );
    });

    test("should return success=false when no questions have insights enabled after update", async () => {
      // Mock data
      const surveyId = "survey-123";
      const mockSurvey: TSurvey = {
        ...mockSurveyOutput,
        type: "link",
        segment: null,
        displayPercentage: null,
        questions: [
          {
            id: "cm8cjnse3000009jxf20v91ic",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question 1" },
            required: true,
            inputType: "text",
            charLimit: {},
            insightsEnabled: false,
          },
        ],
      };

      // Setup mocks
      vi.mocked(getSurvey).mockResolvedValueOnce(mockSurvey);
      vi.mocked(doesSurveyHasOpenTextQuestion).mockReturnValueOnce(true);
      vi.mocked(updateSurvey).mockResolvedValueOnce(mockSurvey);

      // Execute function
      const result = await generateInsightsEnabledForSurveyQuestions(surveyId);

      // Verify results
      expect(result).toEqual({ success: false });
    });

    test("should propagate any errors that occur", async () => {
      // Setup mocks
      const testError = new Error("Test error");
      vi.mocked(getSurvey).mockRejectedValueOnce(testError);

      // Execute and verify function
      await expect(generateInsightsEnabledForSurveyQuestions("survey-123")).rejects.toThrow(testError);
    });
  });

  describe("doesResponseHasAnyOpenTextAnswer", () => {
    test("should return true when at least one open text question has an answer", () => {
      const openTextQuestionIds = ["q1", "q2", "q3"];
      const response = {
        q1: "",
        q2: "This is an answer",
        q3: "",
        q4: "This is not an open text answer",
      };

      const result = doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response);

      expect(result).toBe(true);
    });

    test("should return false when no open text questions have answers", () => {
      const openTextQuestionIds = ["q1", "q2", "q3"];
      const response = {
        q1: "",
        q2: "",
        q3: "",
        q4: "This is not an open text answer",
      };

      const result = doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response);

      expect(result).toBe(false);
    });

    test("should return false when response does not contain any open text question IDs", () => {
      const openTextQuestionIds = ["q1", "q2", "q3"];
      const response = {
        q4: "This is not an open text answer",
        q5: "Another answer",
      };

      const result = doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response);

      expect(result).toBe(false);
    });

    test("should return false for non-string answers", () => {
      const openTextQuestionIds = ["q1", "q2", "q3"];
      const response = {
        q1: "",
        q2: 123,
        q3: true,
      } as any; // Use type assertion to handle mixed types in the test

      const result = doesResponseHasAnyOpenTextAnswer(openTextQuestionIds, response);

      expect(result).toBe(false);
    });
  });
});
