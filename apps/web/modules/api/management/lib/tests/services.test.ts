import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getResponse, getSurvey } from "../services";

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
    it("should return ok with survey data when the survey is found", async () => {
      const surveyId = "survey_123";
      vi.mocked(prisma.survey.findUnique).mockResolvedValue({ environmentId: "env_123" });

      const result = await getSurvey(surveyId);

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ environmentId: "env_123" });
      }
    });

    it("should return a not_found error when the survey is not found", async () => {
      const surveyId = "survey_not_found";
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

      const result = await getSurvey(surveyId);

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

    it("should return an internal_server_error when an exception is thrown", async () => {
      const surveyId = "survey_error";
      vi.mocked(prisma.survey.findUnique).mockRejectedValue(new Error("db error"));

      const result = await getSurvey(surveyId);

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "survey", issue: "not found" }],
        });
      }
    });
  });

  describe("getResponse", () => {
    it("should return ok with response data when the response is found", async () => {
      const responseId = "response_123";
      vi.mocked(prisma.response.findUnique).mockResolvedValue({ surveyId: "survey_abc" });

      const result = await getResponse(responseId);

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ surveyId: "survey_abc" });
      }
    });

    it("should return a not_found error when the response is not found", async () => {
      const responseId = "response_not_found";
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const result = await getResponse(responseId);

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

    it("should return an internal_server_error when an exception is thrown", async () => {
      const responseId = "response_error";
      vi.mocked(prisma.response.findUnique).mockRejectedValue(new Error("db error"));

      const result = await getResponse(responseId);

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    });
  });
});
