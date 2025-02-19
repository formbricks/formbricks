import { environmentId, responseId, surveyId } from "./__mocks__/services.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getResponseSurveyId, getSurveyEnvironmentId } from "../services";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    response: { findUnique: vi.fn() },
  },
}));

describe("Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSurvey", () => {
    test("return ok with survey data when the survey is found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue({ environmentId });

      const result = await getSurveyEnvironmentId(surveyId);

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ environmentId });
      }
    });

    test("return a not_found error when the survey is not found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

      const result = await getSurveyEnvironmentId(surveyId);

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "survey", issue: "not found" }],
        });
      }
    });

    test("return an internal_server_error when an exception is thrown", async () => {
      vi.mocked(prisma.survey.findUnique).mockRejectedValue(new Error("db error"));

      const result = await getSurveyEnvironmentId(surveyId);

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "survey", issue: "db error" }],
        });
      }
    });
  });

  describe("getResponse", () => {
    test("return ok with response data when the response is found", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue({ surveyId });

      const result = await getResponseSurveyId(responseId);

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ surveyId });
      }
    });

    test("return a not_found error when the response is not found", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const result = await getResponseSurveyId(responseId);

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    });

    test("return an internal_server_error when an exception is thrown", async () => {
      vi.mocked(prisma.response.findUnique).mockRejectedValue(new Error("db error"));

      const result = await getResponseSurveyId(responseId);

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "db error" }],
        });
      }
    });
  });
});
