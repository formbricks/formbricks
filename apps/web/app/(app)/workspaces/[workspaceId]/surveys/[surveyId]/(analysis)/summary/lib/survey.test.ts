import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { deleteResponsesAndDisplaysForSurvey, getQuotasSummary } from "./survey";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    display: {
      deleteMany: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    surveyQuota: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/modules/storage/lib/delete-response-files", () => ({
  deleteResponseFileUrls: vi.fn(),
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";
const workspaceId = "u8qa6u0tlxb6160pi2jb8s4p";
const fileUploadElementId = "y3ydd3td2iq09wa599cxo1me";

const fileUploadSurvey = {
  workspaceId,
  questions: [],
  blocks: [
    {
      id: "block-1",
      elements: [{ id: fileUploadElementId, type: "fileUpload" }],
    },
  ],
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  // Default: a survey with no file-upload element, so the response scan is skipped.
  vi.mocked(prisma.survey.findUnique).mockResolvedValue({
    workspaceId,
    questions: [],
    blocks: [],
  } as any);
});

describe("Tests for deleteResponsesAndDisplaysForSurvey service", () => {
  describe("Happy Path", () => {
    test("Deletes all responses and displays for a survey", async () => {
      const { prisma } = await import("@formbricks/database");

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
      const { prisma } = await import("@formbricks/database");

      // Mock $transaction to return zero counts
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 0 }, { count: 0 }]);

      const result = await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(result).toEqual({
        deletedResponsesCount: 0,
        deletedDisplaysCount: 0,
      });
    });

    test("Deletes the uploaded files held by the deleted responses", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(fileUploadSurvey as any);
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        {
          id: "response-1",
          data: {
            [fileUploadElementId]: [
              `https://example.com/storage/${workspaceId}/private/file1.png`,
              `https://example.com/storage/${workspaceId}/private/file2.pdf`,
            ],
            "other-element": "not a file",
          },
        },
        {
          id: "response-2",
          data: { [fileUploadElementId]: [`https://example.com/storage/${workspaceId}/private/file3.png`] },
        },
      ] as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 2 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(deleteResponseFileUrls).toHaveBeenCalledWith(
        [
          `https://example.com/storage/${workspaceId}/private/file1.png`,
          `https://example.com/storage/${workspaceId}/private/file2.pdf`,
          `https://example.com/storage/${workspaceId}/private/file3.png`,
        ],
        workspaceId
      );
    });

    test("Reads the file-upload answers before the responses are deleted", async () => {
      const callOrder: string[] = [];

      vi.mocked(prisma.survey.findUnique).mockResolvedValue(fileUploadSurvey as any);
      vi.mocked(prisma.response.findMany).mockImplementation((async () => {
        callOrder.push("scan");
        return [
          {
            id: "response-1",
            data: { [fileUploadElementId]: [`https://example.com/storage/${workspaceId}/private/f.png`] },
          },
        ];
      }) as any);
      vi.mocked(prisma.$transaction).mockImplementation((async () => {
        callOrder.push("delete");
        return [{ count: 1 }, { count: 0 }];
      }) as any);
      vi.mocked(deleteResponseFileUrls).mockImplementation((async () => {
        callOrder.push("storage");
      }) as any);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      // The scan must precede the row delete (the URLs live in response.data), and storage cleanup must
      // follow it so files are never removed while their responses survive.
      expect(callOrder).toEqual(["scan", "delete", "storage"]);
    });

    test("Skips the response scan when the survey has no file-upload element", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 3 }, { count: 1 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(prisma.response.findMany).not.toHaveBeenCalled();
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });

    test("Ignores non-array answers stored under a file-upload element id", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(fileUploadSurvey as any);
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        { id: "response-1", data: { [fileUploadElementId]: "not-an-array" } },
        { id: "response-2", data: { [fileUploadElementId]: [42, null] } },
      ] as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 2 }, { count: 0 }]);

      await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
    });
  });

  describe("Sad Path", () => {
    test("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const { prisma } = await import("@formbricks/database");

      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.$transaction).mockRejectedValue(errToThrow);

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(DatabaseError);
    });

    test("Throws a generic Error for other exceptions", async () => {
      const { prisma } = await import("@formbricks/database");

      const mockErrorMessage = "Mock error message";
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(Error);
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
    const { prisma } = await import("@formbricks/database");

    vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      })
    );

    await expect(getQuotasSummary(surveyId)).rejects.toThrow(DatabaseError);
  });

  test("Throws a generic Error for other exceptions", async () => {
    const { prisma } = await import("@formbricks/database");

    vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(new Error("Database error"));

    await expect(getQuotasSummary(surveyId)).rejects.toThrow(Error);
  });
});
