import { response, responseId, responseInput, survey } from "./__mocks__/response.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ok, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuota } from "@formbricks/types/quota";
import { getDisplayForResponseValidation } from "@/lib/display/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { deleteDisplay } from "../display";
import {
  deleteResponse,
  getResponse,
  getResponseForPipeline,
  updateResponse,
  updateResponseWithQuotaEvaluation,
} from "../response";
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

// ENG-1923 fixtures: the response's own tenant + a display that legitimately belongs to it.
const responseWorkspaceId = "ws_mock_workspace_id";
const existingResponseRow = {
  surveyId: responseInput.surveyId,
  contactId: responseInput.contactId,
  survey: { workspaceId: responseWorkspaceId },
};
const validDisplay = {
  surveyId: responseInput.surveyId,
  workspaceId: responseWorkspaceId,
  responseId, // linked to this response (self) → allowed on update
  contactId: responseInput.contactId,
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

vi.mock("@/lib/display/service", () => ({
  getDisplayForResponseValidation: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
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

  describe("getResponseForPipeline", () => {
    test("return the response with contact and tags when found", async () => {
      const mockPrismaResponse = {
        id: responseId,
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "kbr8tnr2q2vgztyrfnqlgfjt",
        displayId: "jowdit1qrf04t97jcc0io9di",
        finished: true,
        data: { question1: "answer1" },
        meta: {},
        ttc: {},
        variables: {},
        contactAttributes: { userId: "user123" },
        singleUseId: null,
        language: "en",
        endingId: null,
        contact: {
          id: "olwablfltg9eszoh0nz83w02",
        },
        tags: [
          {
            tag: {
              id: "tag123",
              createdAt: new Date(),
              updatedAt: new Date(),
              name: "important",
              workspaceId: "workspace-id-mock",
            },
          },
        ],
      };

      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockPrismaResponse as any);

      const result = await getResponseForPipeline(responseId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          ...mockPrismaResponse,
          contact: {
            id: "olwablfltg9eszoh0nz83w02",
            userId: "user123",
          },
          tags: [
            {
              id: "tag123",
              createdAt: mockPrismaResponse.tags[0].tag.createdAt,
              updatedAt: mockPrismaResponse.tags[0].tag.updatedAt,
              name: "important",
              workspaceId: "workspace-id-mock",
            },
          ],
        });
      }
      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        include: {
          contact: {
            select: {
              id: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  name: true,
                  workspaceId: true,
                },
              },
            },
          },
        },
      });
    });

    test("return the response with null contact when contact does not exist", async () => {
      const mockPrismaResponseWithoutContact = {
        id: responseId,
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "kbr8tnr2q2vgztyrfnqlgfjt",
        displayId: "jowdit1qrf04t97jcc0io9di",
        finished: true,
        data: { question1: "answer1" },
        meta: {},
        ttc: {},
        variables: {},
        contactAttributes: null,
        singleUseId: null,
        language: "en",
        endingId: null,
        contact: null,
        tags: [],
      };

      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockPrismaResponseWithoutContact as any);

      const result = await getResponseForPipeline(responseId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.contact).toBeNull();
        expect(result.data.tags).toEqual([]);
      }
    });

    test("return a not_found error when the response is missing", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const result = await getResponseForPipeline(responseId);
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

      const result = await getResponseForPipeline(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "response", issue: "DB error" }],
        });
      }
    });

    test("handle response with contact but no userId in contactAttributes", async () => {
      const mockPrismaResponse = {
        id: responseId,
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "kbr8tnr2q2vgztyrfnqlgfjt",
        displayId: null,
        finished: false,
        data: {},
        meta: {},
        ttc: {},
        variables: {},
        contactAttributes: {},
        singleUseId: null,
        language: "en",
        endingId: null,
        contact: {
          id: "contact-id",
        },
        tags: [],
      };

      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockPrismaResponse as any);

      const result = await getResponseForPipeline(responseId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.contact).toEqual({
          id: "contact-id",
          userId: undefined,
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
      expect(findAndDeleteUploadedFilesInResponse).toHaveBeenCalledWith(
        response.data,
        survey,
        survey.workspaceId
      );
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
          code: PrismaErrorType.RecordNotFound,
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
    // ENG-1923: updateResponse now validates the caller-supplied contactId/displayId against the
    // response's own tenant before writing. Default these lookups to the happy path; reject tests
    // override them.
    beforeEach(() => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(existingResponseRow as any);
      vi.mocked(prisma.contact.findUnique).mockResolvedValue({ id: responseInput.contactId } as any);
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue(validDisplay);
    });

    test("update the response and revalidate caches including singleUseId", async () => {
      vi.mocked(prisma.response.update).mockResolvedValue(response);

      const result = await updateResponse(responseId, responseInput);
      expect(prisma.response.update).toHaveBeenCalledWith({
        where: { id: responseId },
        data: { ...responseInput, language: "en-US" }, // language canonicalized on write
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
        data: { ...responseInput, language: "en-US" }, // language canonicalized on write
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(responseWithoutSingleUseId);
      }
    });

    test("return a not_found error when the response is not found", async () => {
      vi.mocked(prisma.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Response not found", {
          code: PrismaErrorType.RecordNotFound,
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

    // ENG-1923 perf: when the update sets no contact/display link (both null) there is no FK to
    // validate, so the tenant lookup is skipped entirely — a missing response is still surfaced as
    // a 404 by the update's Prisma handler. Guards against reintroducing an unconditional
    // round-trip when neither link is being (re)assigned.
    test("skips the tenant lookup when neither contactId nor displayId is set", async () => {
      const inputWithoutLinks = { ...responseInput, contactId: null, displayId: null };
      vi.mocked(prisma.response.update).mockResolvedValue(response);

      const result = await updateResponse(responseId, inputWithoutLinks);

      expect(result.ok).toBe(true);
      expect(prisma.response.findUnique).not.toHaveBeenCalled();
      expect(prisma.contact.findUnique).not.toHaveBeenCalled();
      expect(getDisplayForResponseValidation).not.toHaveBeenCalled();
      expect(prisma.response.update).toHaveBeenCalledTimes(1);
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

    // ENG-1923: a caller authorized on this response must not re-point it at another tenant's
    // contact or display. Foreign and nonexistent ids fail identically as a 404 — no oracle.
    test("rejects a contactId that does not belong to the response's workspace (ENG-1923)", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

      const result = await updateResponse(responseId, responseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "contactId", issue: "not found" }],
        });
      }
      // The lookup itself must be workspace-scoped: asserting only the rejection would still pass
      // if the `workspaceId` filter were dropped, since the mock returns null either way.
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: responseInput.contactId, workspaceId: responseWorkspaceId },
        select: { id: true },
      });
      expect(prisma.response.update).not.toHaveBeenCalled();
    });

    test("rejects a displayId from another workspace (ENG-1923)", async () => {
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue({
        ...validDisplay,
        workspaceId: "another-workspace",
      });

      const result = await updateResponse(responseId, responseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "displayId", issue: "not found" }],
        });
      }
      expect(prisma.response.update).not.toHaveBeenCalled();
    });

    // ENG-1923: the tenant guard must not reject legitimate same-tenant edits. contactId and
    // displayId are required-nullable in ZResponseUpdateSchema, so every PUT carries both — clearing
    // the contact while keeping the response's own display is an ordinary update, even though that
    // display still records the previous contact. Tenant isolation comes from workspace + survey +
    // self-link; a display↔contact match rule would 404 this case, reported against the wrong field.
    test("allows clearing contactId while keeping the response's own displayId (ENG-1923)", async () => {
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue({
        ...validDisplay,
        contactId: responseInput.contactId, // display still points at the contact being unlinked
      });
      vi.mocked(prisma.response.update).mockResolvedValue(response);

      const result = await updateResponse(responseId, { ...responseInput, contactId: null });

      expect(result.ok).toBe(true);
      // No contact lookup is needed when the caller is clearing the link.
      expect(prisma.contact.findUnique).not.toHaveBeenCalled();
      expect(prisma.response.update).toHaveBeenCalledTimes(1);
    });

    test("rejects a displayId already linked to a different response (ENG-1923)", async () => {
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue({
        ...validDisplay,
        responseId: "some-other-response",
      });

      const result = await updateResponse(responseId, responseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "displayId", issue: "not found" }],
        });
      }
      expect(prisma.response.update).not.toHaveBeenCalled();
    });

    // ENG-1923: the anti-enumeration property itself. A display that exists but belongs to another
    // tenant and one that does not exist at all must be reported identically, or the endpoint
    // becomes a cross-tenant existence oracle. Asserting each rejection separately would not catch
    // a later change that made one of them more specific.
    test("reports a foreign and a nonexistent displayId identically (ENG-1923)", async () => {
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue({
        ...validDisplay,
        workspaceId: "another-workspace",
      });
      const foreign = await updateResponse(responseId, responseInput);

      vi.mocked(getDisplayForResponseValidation).mockResolvedValue(null);
      const missing = await updateResponse(responseId, responseInput);

      expect(foreign.ok).toBe(false);
      expect(missing.ok).toBe(false);
      if (!foreign.ok && !missing.ok) {
        expect(missing.error).toEqual(foreign.error);
      }
      expect(prisma.response.update).not.toHaveBeenCalled();
    });

    test("returns not_found when the response does not exist (ENG-1923)", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const result = await updateResponse(responseId, responseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
      expect(prisma.response.update).not.toHaveBeenCalled();
    });
  });

  describe("updateResponseWithQuotaEvaluation", () => {
    type MockTx = {
      response: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      contact: {
        findUnique: ReturnType<typeof vi.fn>;
      };
    };
    let mockTx: MockTx;

    beforeEach(() => {
      vi.clearAllMocks();

      mockTx = {
        response: {
          // ENG-1923: updateResponse loads the response's tenant + validates links before writing.
          findUnique: vi.fn().mockResolvedValue(existingResponseRow),
          update: vi.fn(),
        },
        contact: {
          findUnique: vi.fn().mockResolvedValue({ id: responseInput.contactId }),
        },
      };
      vi.mocked(getDisplayForResponseValidation).mockResolvedValue(validDisplay);

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
        data: { ...responseInput, language: "en-US" }, // language canonicalized on write
      });
      expect(evaluateResponseQuotas).toHaveBeenCalledWith({
        surveyId: response.surveyId,
        responseId: response.id,
        data: response.data,
        variables: response.variables,
        language: response.language,
        responseFinished: response.finished,
        // The row just written, so `reserved` quota operands resolve (ENG-1840).
        response,
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
        // The row just written, so `reserved` quota operands resolve (ENG-1840).
        response: responseWithoutLanguage,
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
          code: PrismaErrorType.RecordNotFound,
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
