import { response, responseId, responseInput, survey } from "./__mocks__/response.mock";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ok, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuota } from "@formbricks/types/quota";
import { deleteDisplay } from "../display";
import { deleteResponse, getResponse, updateResponse, updateResponseWithQuotaEvaluation } from "../response";
import { getSurveyQuestions } from "../survey";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

// Mock quota object for testing
const mockQuota: TSurveyQuota = {
  id: "quota-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "kbr8tnr2q2vgztyrfnqlgfjt",
  name: "Test Quota",
  limit: 100,
  logic: {
    connector: "and",
    conditions: [],
  },
  action: "endSurvey",
  endingCardId: "ending-card-id",
  countPartialSubmissions: false,
};

vi.mock("../display", () => ({
  deleteDisplay: vi.fn(),
}));

vi.mock("../survey", () => ({
  getSurveyQuestions: vi.fn(),
}));

vi.mock("../utils", () => ({
  findAndDeleteUploadedFilesInResponse: vi.fn(),
}));

vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({
  evaluateResponseQuotas: vi.fn(),
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
    test("return the response when found", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(response);

      const result = await getResponse(responseId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
      });
    });

    test("return a not_found error when the response is missing", async () => {
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

    test("return an internal_server_error when prisma throws an error", async () => {
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
    test("delete the response, delete the display and remove uploaded files", async () => {
      vi.mocked(prisma.response.delete).mockResolvedValue(response);
      vi.mocked(deleteDisplay).mockResolvedValue(ok(true));
      vi.mocked(getSurveyQuestions).mockResolvedValue(ok(survey));
      vi.mocked(findAndDeleteUploadedFilesInResponse).mockResolvedValue(okVoid());

      const result = await deleteResponse(responseId);
      expect(prisma.response.delete).toHaveBeenCalledWith({
        where: { id: responseId },
      });
      expect(deleteDisplay).toHaveBeenCalledWith(response.displayId);
      expect(getSurveyQuestions).toHaveBeenCalledWith(response.surveyId);
      expect(findAndDeleteUploadedFilesInResponse).toHaveBeenCalledWith(response.data, survey.questions);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("return an error if deleteDisplay fails", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(response);
      vi.mocked(prisma.response.delete).mockResolvedValue(response);
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

    test("return an error if getSurveyQuestions fails", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(response);
      vi.mocked(prisma.response.delete).mockResolvedValue(response);
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

    test("catch exceptions and return an internal_server_error", async () => {
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

    test("handle prisma client error code P2025", async () => {
      vi.mocked(prisma.response.delete).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Response not found", {
          code: PrismaErrorType.RelatedRecordDoesNotExist,
          clientVersion: "1.0.0",
          meta: {
            cause: "Response not found",
          },
        })
      );

      const result = await deleteResponse(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    });
  });

  describe("updateResponse", () => {
    test("update the response and revalidate caches including singleUseId", async () => {
      vi.mocked(prisma.response.update).mockResolvedValue(response);

      const result = await updateResponse(responseId, responseInput);
      expect(prisma.response.update).toHaveBeenCalledWith({
        where: { id: responseId },
        data: responseInput,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("update the response and revalidate caches", async () => {
      const responseWithoutSingleUseId = { ...response, singleUseId: null };
      vi.mocked(prisma.response.update).mockResolvedValue(responseWithoutSingleUseId);

      const result = await updateResponse(responseId, responseInput);
      expect(prisma.response.update).toHaveBeenCalledWith({
        where: { id: responseId },
        data: responseInput,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(responseWithoutSingleUseId);
      }
    });

    test("return a not_found error when the response is not found", async () => {
      vi.mocked(prisma.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Response not found", {
          code: PrismaErrorType.RelatedRecordDoesNotExist,
          clientVersion: "1.0.0",
          meta: {
            cause: "Response not found",
          },
        })
      );

      const result = await updateResponse(responseId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    });

    test("return an error when prisma.response.update throws", async () => {
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

  describe("updateResponseWithQuotaEvaluation", () => {
    type MockTx = {
      response: {
        update: ReturnType<typeof vi.fn>;
      };
    };
    let mockTx: MockTx;

    beforeEach(() => {
      vi.clearAllMocks();

      mockTx = {
        response: {
          update: vi.fn(),
        },
      };

      prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
    });

    test("update response and continue when quota evaluation says not to end survey", async () => {
      vi.mocked(mockTx.response.update).mockResolvedValue(response);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({
        shouldEndSurvey: false,
        quotaFull: null,
        refreshedResponse: null,
      });

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(mockTx.response.update).toHaveBeenCalledWith({
        where: { id: responseId },
        data: responseInput,
      });
      expect(evaluateResponseQuotas).toHaveBeenCalledWith({
        surveyId: response.surveyId,
        responseId: response.id,
        data: response.data,
        variables: response.variables,
        language: response.language,
        responseFinished: response.finished,
        tx: mockTx,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("handle quota evaluation with default language when response.language is null", async () => {
      const responseWithoutLanguage = { ...response, language: null };
      vi.mocked(mockTx.response.update).mockResolvedValue(responseWithoutLanguage);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({
        shouldEndSurvey: false,
        quotaFull: null,
        refreshedResponse: null,
      });

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(evaluateResponseQuotas).toHaveBeenCalledWith({
        surveyId: responseWithoutLanguage.surveyId,
        responseId: responseWithoutLanguage.id,
        data: responseWithoutLanguage.data,
        variables: responseWithoutLanguage.variables,
        language: "default",
        responseFinished: responseWithoutLanguage.finished,
        tx: mockTx,
      });
      expect(result.ok).toBe(true);
    });

    test("end survey and return refreshed response when quota is full and refreshedResponse exists", async () => {
      const refreshedResponse = { ...response, finished: true, endingId: "new-ending-id" };
      vi.mocked(mockTx.response.update).mockResolvedValue(response);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({
        shouldEndSurvey: true,
        quotaFull: mockQuota,
        refreshedResponse: refreshedResponse,
      });

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(refreshedResponse);
      }
    });

    test("end survey and set finished=true with endingCardId when quota is full but no refreshedResponse", async () => {
      vi.mocked(mockTx.response.update).mockResolvedValue(response);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({
        shouldEndSurvey: true,
        quotaFull: mockQuota,
        refreshedResponse: null,
      });

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          ...response,
          finished: true,
          endingId: "ending-card-id",
        });
      }
    });

    test("end survey and set finished=true when quota is full with no quotaFull object", async () => {
      vi.mocked(mockTx.response.update).mockResolvedValue(response);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({
        shouldEndSurvey: true,
        quotaFull: null,
        refreshedResponse: null,
      });

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          ...response,
          finished: true,
        });
      }
    });

    test("propagate error when updateResponse fails", async () => {
      vi.mocked(mockTx.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Response not found", {
          code: PrismaErrorType.RelatedRecordDoesNotExist,
          clientVersion: "1.0.0",
          meta: {
            cause: "Response not found",
          },
        })
      );

      const result = await updateResponseWithQuotaEvaluation(responseId, responseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
      expect(evaluateResponseQuotas).not.toHaveBeenCalled();
    });
  });
});
