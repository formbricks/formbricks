import { mockSurvey } from "./__mocks__/survey.mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSurveyQuestions } from "../survey";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Survey Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSurveyQuestions", () => {
    it("should return survey questions and environmentId when the survey is found", async () => {
      const surveyId = "survey_1";
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);

      const result = await getSurveyQuestions(surveyId);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: {
          environmentId: true,
          questions: true,
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockSurvey);
      }
    });

    it("should return a not_found error when the survey does not exist", async () => {
      const surveyId = "non_existing";
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

      const result = await getSurveyQuestions(surveyId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "survey", issue: "not found" }],
        });
      }
    });

    it("should return an internal_server_error when prisma.survey.findUnique throws an error", async () => {
      const surveyId = "survey_error";
      vi.mocked(prisma.survey.findUnique).mockRejectedValue(new Error("DB error"));

      const result = await getSurveyQuestions(surveyId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "survey", issue: "DB error" }],
        });
      }
    });
  });
});
