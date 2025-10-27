import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteResponsesAndDisplaysForSurvey, getQuotasSummary } from "./survey";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      deleteMany: vi.fn(),
    },
    display: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    surveyQuota: {
      findMany: vi.fn(),
    },
  },
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
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
      },
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
      },
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
