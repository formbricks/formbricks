import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationFeedbackRecordDirectory } from "../types/api-keys";
import { getFeedbackRecordDirectoriesByOrganizationId } from "./feedback-record-directories";

const mockDirectories: TOrganizationFeedbackRecordDirectory[] = [
  {
    id: "dir1",
    name: "Directory 1",
  },
  {
    id: "dir2",
    name: "Directory 2",
  },
];

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackRecordDirectory: {
      findMany: vi.fn(),
    },
  },
}));

describe("Feedback Record Directories Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeedbackRecordDirectoriesByOrganizationId", () => {
    test("retrieves non-archived directories by organization ID successfully", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockResolvedValueOnce(
        mockDirectories as unknown as Awaited<ReturnType<typeof prisma.feedbackRecordDirectory.findMany>>
      );

      const result = await getFeedbackRecordDirectoriesByOrganizationId("org123");

      expect(result).toEqual(mockDirectories);
      expect(prisma.feedbackRecordDirectory.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org123",
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("returns empty array when no directories exist", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackRecordDirectoriesByOrganizationId("org123");

      expect(result).toEqual([]);
      expect(prisma.feedbackRecordDirectory.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org123",
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("throws DatabaseError on prisma known request error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockRejectedValueOnce(errToThrow);

      await expect(getFeedbackRecordDirectoriesByOrganizationId("org123")).rejects.toThrow(DatabaseError);
    });

    test("bubbles up unexpected errors", async () => {
      const unexpectedError = new Error("Unexpected error");
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockRejectedValueOnce(unexpectedError);

      await expect(getFeedbackRecordDirectoriesByOrganizationId("org123")).rejects.toThrow(unexpectedError);
    });
  });
});
