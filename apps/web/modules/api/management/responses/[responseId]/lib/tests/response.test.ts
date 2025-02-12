import { Response, Survey } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ok, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { deleteDisplay } from "../display";
import { deleteResponse, getResponse, updateResponse } from "../response";
import { getSurveyQuestions } from "../survey";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("./display", () => ({
  deleteDisplay: vi.fn(),
}));

vi.mock("./survey", () => ({
  getSurveyQuestions: vi.fn(),
}));

vi.mock("./utils", () => ({
  findAndDeleteUploadedFilesInResponse: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    display: {
      delete: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Response Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getResponse", () => {
    it("should return the response when found", async () => {
      const responseId = "resp_1";
      const mockResponse = { id: responseId, surveyId: "survey_1", displayId: null };
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse);

      const result = await getResponse(responseId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockResponse);
      }
      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
      });
    });

    it("should return a not_found error when the response is missing", async () => {
      const responseId = "non_existing";
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const result = await getResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    });

    it("should return an internal_server_error when prisma throws an error", async () => {
      const responseId = "resp_error";
      vi.mocked(prisma.response.findUnique).mockRejectedValue(new Error("DB error"));

      const result = await getResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "DB error" }],
        });
      }
    });
  });

  describe("deleteResponse", () => {
    const responseId = "resp_1";
    const mockResponse: Response = {
      id: responseId,
      data: { file: "fileUrl" },
      surveyId: "survey_1",
      displayId: "disp_1",
      createdAt: new Date(),
      updatedAt: new Date(),
      finished: true,
      contactAttributes: {},
      contactId: "contact_1",
      endingId: "ending_1",
      variables: [],
      ttc: {},
      language: "en",
      meta: {},
      singleUseId: "single_use_1",
    };
    const mockSurveyQuestions: Pick<Survey, "questions" | "environmentId"> = {
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { en: "Question 1" },
          required: true,
          inputType: "text",
          charLimit: {},
        },
      ],
      environmentId: "env_1",
    };
    it("should delete the response, delete the display and remove uploaded files", async () => {
      vi.mocked(prisma.response.delete).mockResolvedValue(mockResponse);
      vi.mocked(deleteDisplay).mockResolvedValue(ok(true));
      vi.mocked(getSurveyQuestions).mockResolvedValue(ok(mockSurveyQuestions));
      vi.mocked(findAndDeleteUploadedFilesInResponse).mockResolvedValue(okVoid());

      const result = await deleteResponse(responseId);
      expect(prisma.response.delete).toHaveBeenCalledWith({
        where: { id: responseId },
      });
      expect(deleteDisplay).toHaveBeenCalledWith(mockResponse.displayId);
      expect(getSurveyQuestions).toHaveBeenCalledWith(mockResponse.surveyId);
      expect(findAndDeleteUploadedFilesInResponse).toHaveBeenCalledWith(
        mockResponse.data,
        mockSurveyQuestions.questions
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockResponse);
      }
    });

    it("should return an error if deleteDisplay fails", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse);
      vi.mocked(prisma.response.delete).mockResolvedValue(mockResponse);
      vi.mocked(deleteDisplay).mockResolvedValue({
        ok: false,
        error: { type: "internal_server_error", details: [{ field: "display", issue: "delete failed" }] },
      });

      const result = await deleteResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "display", issue: "delete failed" }],
        });
      }
    });

    it("should return an error if getSurveyQuestions fails", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse);
      vi.mocked(prisma.response.delete).mockResolvedValue(mockResponse);
      vi.mocked(deleteDisplay).mockResolvedValue(ok(true));
      vi.mocked(getSurveyQuestions).mockResolvedValue({
        ok: false,
        error: { type: "not_found", details: [{ field: "survey", issue: "not found" }] },
      });

      const result = await deleteResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "survey", issue: "not found" }],
        });
      }
    });

    it("should catch exceptions and return an internal_server_error", async () => {
      vi.mocked(prisma.response.delete).mockRejectedValue(new Error("Unexpected error"));
      const result = await deleteResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "Unexpected error" }],
        });
      }
    });
  });

  describe("updateResponse", () => {
    const responseId = "resp_1";
    const responseInput: Omit<Response, "id"> = {
      surveyId: "survey_1",
      displayId: null,
      data: { key: "value" },
      createdAt: new Date(),
      updatedAt: new Date(),
      finished: true,
      contactId: "contact_1",
      endingId: "ending_1",
      variables: [],
      ttc: {},
      language: "en",
      meta: {},
      singleUseId: "single_use_1",
      contactAttributes: {},
    };
    const updatedResponse = { id: responseId, ...responseInput };

    it("should update the response and revalidate caches", async () => {
      (prisma.response.update as any).mockResolvedValue(updatedResponse);

      const result = await updateResponse(responseId, responseInput);
      expect(prisma.response.update).toHaveBeenCalledWith({
        where: { id: responseId },
        data: responseInput,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(updatedResponse);
      }
    });

    it("should return an error when prisma.response.update throws", async () => {
      vi.mocked(prisma.response.update).mockRejectedValue(new Error("Update failed"));
      const result = await updateResponse(responseId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "Update failed" }],
        });
      }
    });
  });
});
