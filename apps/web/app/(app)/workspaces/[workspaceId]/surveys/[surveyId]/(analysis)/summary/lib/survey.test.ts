import { deleteResponseFileUrls } from "./__mocks__/delete-response-files.mock";
import {
  ScannedResponse,
  SurveyFileUploadFields,
  fileUploadElement,
  responseWithFiles,
  scanTimestamp,
  storageUrl,
  surveyId,
  surveyWithFileUpload,
  surveyWithoutFileUpload,
  workspaceId,
} from "./__mocks__/survey-reset.mock";
import { getSurvey } from "./__mocks__/survey-service.mock";
import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { deleteResponsesAndDisplaysForSurvey, getQuotasSummary } from "./survey";

/**
 * The fixtures declare only the three fields the service reads, so the hand-off to `getSurvey` (typed
 * `TSurvey | null`) is cast once here. The fixture fields themselves stay typed against
 * `@formbricks/types`, so a wrong block or element shape still fails typecheck.
 */
const mockSurvey = (survey: SurveyFileUploadFields | null) => {
  getSurvey.mockResolvedValue(survey as TSurvey | null);
};

const mockResponsePages = (...pages: ScannedResponse[][]) => {
  const findMany = vi.mocked(prisma.response.findMany);
  findMany.mockReset();
  for (const page of pages) {
    findMany.mockResolvedValueOnce(page as never);
  }
  // Anything past the configured pages reads as "no more rows".
  findMany.mockResolvedValue([] as never);
};

beforeEach(() => {
  // Default: a survey with no file-upload element, so the response scan is skipped.
  mockSurvey(surveyWithoutFileUpload);
  deleteResponseFileUrls.mockReset();
  deleteResponseFileUrls.mockResolvedValue(undefined);
});

describe("Tests for deleteResponsesAndDisplaysForSurvey service", () => {
  describe("Happy Path", () => {
    test("Deletes all responses and displays for a survey", async () => {
      // Mock $transaction to return the results directly
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 5 }, { count: 3 }]);

      const result = await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        deletedResponsesCount: 5,
        deletedDisplaysCount: 3,
      });
    });

    test("Handles case with no responses or displays to delete", async () => {
      // Mock $transaction to return zero counts
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 0 }, { count: 0 }]);

      const result = await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(result).toEqual({
        deletedResponsesCount: 0,
        deletedDisplaysCount: 0,
      });
    });

    test("Deletes the uploaded files held by the deleted responses", async () => {
      mockSurvey(surveyWithFileUpload);
      mockResponsePages([
        {
          id: "response-1",
          createdAt: scanTimestamp(0),
          data: {
            [fileUploadElement.id]: [storageUrl("file1.png"), storageUrl("file2.pdf")],
            "other-element": "not a file",
          },
        },
        responseWithFiles("response-2", ["file3.png"]),
      ]);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 2 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(deleteResponseFileUrls).toHaveBeenCalledTimes(1);
      expect(deleteResponseFileUrls).toHaveBeenCalledWith(
        [storageUrl("file1.png"), storageUrl("file2.pdf"), storageUrl("file3.png")],
        workspaceId
      );
    });

    test("Reads the file-upload answers before the responses are deleted", async () => {
      const callOrder: string[] = [];

      mockSurvey(surveyWithFileUpload);
      vi.mocked(prisma.response.findMany).mockReset();
      vi.mocked(prisma.response.findMany).mockImplementation((() => {
        callOrder.push("scan");
        return Promise.resolve([responseWithFiles("response-1", ["f.png"])]) as never;
      }) as never);
      vi.mocked(prisma.$transaction).mockImplementation((() => {
        callOrder.push("delete");
        return Promise.resolve([{ count: 1 }, { count: 0 }]) as never;
      }) as never);
      deleteResponseFileUrls.mockImplementation(async () => {
        callOrder.push("storage");
      });

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      // The scan must precede the row delete (the URLs live in response.data), and storage cleanup must
      // follow it so files are never removed while their responses survive.
      expect(callOrder).toEqual(["scan", "delete", "storage"]);
    });

    test("Collects files from every page when responses span the scan page size", async () => {
      // A full first page (500) forces a second cursor-based query; the file on the later page must
      // still reach storage cleanup.
      const firstPage = Array.from({ length: 500 }, (_, index) =>
        responseWithFiles(`response-${index}`, [`page1-${index}.png`], index)
      );
      const secondPage = [responseWithFiles("response-500", ["page2.png"], 500)];

      mockSurvey(surveyWithFileUpload);
      mockResponsePages(firstPage, secondPage);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 501 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      // Third call returns [] and ends the loop: 500 == page size, then 1 < page size would stop it,
      // so exactly two queries are expected here.
      expect(prisma.response.findMany).toHaveBeenCalledTimes(2);

      // The second query pages past the last row of the first page with a (createdAt, id) keyset, and
      // orders by createdAt so it can use the existing (surveyId, createdAt) index.
      const secondQuery = vi.mocked(prisma.response.findMany).mock.calls[1][0];
      expect(secondQuery).toMatchObject({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: {
          surveyId,
          OR: [
            { createdAt: { gt: scanTimestamp(499) } },
            { createdAt: scanTimestamp(499), id: { gt: "response-499" } },
          ],
        },
      });
      // Keyset paging replaces cursor/skip entirely — a leftover offset would double-read rows.
      expect(secondQuery).not.toHaveProperty("skip");
      expect(secondQuery).not.toHaveProperty("cursor");

      const deletedUrls = deleteResponseFileUrls.mock.calls.flatMap(([urls]) => urls);
      expect(deletedUrls).toHaveLength(501);
      expect(deletedUrls).toContain(storageUrl("page1-0.png"));
      expect(deletedUrls).toContain(storageUrl("page2.png"));
    });

    test("Issues storage deletes in bounded chunks", async () => {
      const responses = Array.from({ length: 250 }, (_, index) =>
        responseWithFiles(`response-${index}`, [`file-${index}.png`])
      );

      mockSurvey(surveyWithFileUpload);
      mockResponsePages(responses);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 250 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      // 250 URLs at a chunk size of 100 => 100 + 100 + 50, so no single storage fan-out exceeds 100.
      expect(deleteResponseFileUrls.mock.calls.map(([urls]) => urls.length)).toEqual([100, 100, 50]);
    });

    test("Skips the response scan when the survey has no file-upload element", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 3 }, { count: 1 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(prisma.response.findMany).not.toHaveBeenCalled();
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });

    test("Skips storage cleanup when the survey no longer exists", async () => {
      mockSurvey(null);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(prisma.response.findMany).not.toHaveBeenCalled();
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });

    test("Ignores non-array answers stored under a file-upload element id", async () => {
      mockSurvey(surveyWithFileUpload);
      mockResponsePages([
        { id: "response-1", createdAt: scanTimestamp(0), data: { [fileUploadElement.id]: "not-an-array" } },
        // Numbers and nulls inside the array are dropped rather than cast to a delete target.
        {
          id: "response-2",
          createdAt: scanTimestamp(1),
          data: { [fileUploadElement.id]: [42, null] as unknown as string[] },
        },
      ]);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 2 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });
  });

  describe("Sad Path", () => {
    test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      mockSurvey(surveyWithFileUpload);
      mockResponsePages([responseWithFiles("response-1", ["file1.png"])]);
      vi.mocked(prisma.$transaction).mockRejectedValue(errToThrow);

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(DatabaseError);

      // The converse of the ordering guarantee: if the rows survive, their files must survive too.
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });

    test("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(Error);
    });

    test("Reports the reset as successful when storage cleanup fails", async () => {
      mockSurvey(surveyWithFileUpload);
      mockResponsePages([responseWithFiles("response-1", ["file1.png"])]);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }, { count: 0 }]);
      deleteResponseFileUrls.mockRejectedValue(new Error("storage down"));
      const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

      // The rows are already committed as deleted, so a storage failure must not surface as a failed
      // reset the caller would retry — it is logged and the counts still come back.
      const result = await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(result).toEqual({ deletedResponsesCount: 1, deletedDisplaysCount: 0 });
      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });
});

describe("Tests for getQuotasSummary service", () => {
  test("Returns the correct quotas summary", async () => {
    vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue([
      {
        id: "quota123",
        name: "Test Quota",
        limit: 100,
        _count: {
          quotaLinks: 0,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.surveyQuota.findMany>>[number],
    ]);
    const result = await getQuotasSummary(surveyId);
    expect(result).toEqual([
      {
        id: "quota123",
        name: "Test Quota",
        limit: 100,
        count: 0,
        percentage: 0,
      },
    ]);
  });
  test("Returns 0 percentage if limit is 0", async () => {
    vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue([
      {
        id: "quota123",
        name: "Test Quota",
        limit: 0,
        _count: {
          quotaLinks: 0,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.surveyQuota.findMany>>[number],
    ]);
    const result = await getQuotasSummary(surveyId);
    expect(result).toEqual([
      {
        id: "quota123",
        name: "Test Quota",
        limit: 0,
        count: 0,
        percentage: 0,
      },
    ]);
  });
  test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
    vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      })
    );
    await expect(getQuotasSummary(surveyId)).rejects.toThrow(DatabaseError);
  });
  test("Throws a generic Error for other exceptions", async () => {
    vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(new Error("Database error"));
    await expect(getQuotasSummary(surveyId)).rejects.toThrow(Error);
  });
});
