import { response, responseId, responseInput, survey } from "./__mocks__/response.mock";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ok, okVoid } from "@formbricks/types/error-handlers";
import { deleteDisplay } from "../display";
import { deleteResponse, getResponse, updateResponse } from "../response";
import { getSurveyQuestions } from "../survey";
import { findAndDeleteUploadedFilesInResponse } from "../utils";

vi.mock("../display", () => ({
  deleteDisplay: vi.fn(),
}));

vi.mock("../survey", () => ({
  getSurveyQuestions: vi.fn(),
}));

vi.mock("../utils", () => ({
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
        new PrismaClientKnownRequestError("Response not found", {
          code: "P2025",
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
    test("update the response and revalidate caches", async () => {
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

    test("return a not_found error when the response is not found", async () => {
      vi.mocked(prisma.response.update).mockRejectedValue(
        new PrismaClientKnownRequestError("Response not found", {
          code: "P2025",
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
});
