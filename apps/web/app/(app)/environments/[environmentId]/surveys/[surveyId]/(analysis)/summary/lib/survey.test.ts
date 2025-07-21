import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteResponsesAndDisplaysForSurvey } from "./survey";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      deleteMany: vi.fn(),
    },
    display: {
      deleteMany: vi.fn(),
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

      vi.mocked(prisma.response.deleteMany).mockResolvedValue({ count: 5 });
      vi.mocked(prisma.display.deleteMany).mockResolvedValue({ count: 3 });

      const result = await deleteResponsesAndDisplaysForSurvey(surveyId);

      expect(prisma.response.deleteMany).toHaveBeenCalledWith({
        where: { surveyId: surveyId },
      });
      expect(prisma.display.deleteMany).toHaveBeenCalledWith({
        where: { surveyId: surveyId },
      });
      expect(result).toEqual({
        deletedResponsesCount: 5,
        deletedDisplaysCount: 3,
      });
    });

    test("Handles case with no responses or displays to delete", async () => {
      const { prisma } = await import("@formbricks/database");

      vi.mocked(prisma.response.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.display.deleteMany).mockResolvedValue({ count: 0 });

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

      vi.mocked(prisma.response.deleteMany).mockRejectedValue(errToThrow);

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(DatabaseError);
    });

    test("Throws a generic Error for other exceptions", async () => {
      const { prisma } = await import("@formbricks/database");

      const mockErrorMessage = "Mock error message";
      vi.mocked(prisma.response.deleteMany).mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteResponsesAndDisplaysForSurvey(surveyId)).rejects.toThrow(Error);
    });
  });

  describe("Input Validation", () => {
    testInputValidation(deleteResponsesAndDisplaysForSurvey, "123#");
  });
});
