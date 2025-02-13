import { survey } from "./__mocks__/survey.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
    test("return survey questions and environmentId when the survey is found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(survey);

      const result = await getSurveyQuestions(survey.id);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: survey.id },
        select: {
          environmentId: true,
          questions: true,
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(survey);
      }
    });

    test("return a not_found error when the survey does not exist", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

      const result = await getSurveyQuestions(survey.id);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "survey", issue: "not found" }],
        });
      }
    });

    test("return an internal_server_error when prisma.survey.findUnique throws an error", async () => {
      vi.mocked(prisma.survey.findUnique).mockRejectedValue(new Error("DB error"));

      const result = await getSurveyQuestions(survey.id);
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
