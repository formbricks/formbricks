import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationFeedbackDirectory } from "../types/api-keys";
import { getFeedbackDirectoriesByOrganizationId } from "./feedback-directories";

const mockDirectories: TOrganizationFeedbackDirectory[] = [
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
    feedbackDirectory: {
      findMany: vi.fn(),
    },
  },
}));

describe("Feedback Directories Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeedbackDirectoriesByOrganizationId", () => {
    test("retrieves non-archived directories by organization ID successfully", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValueOnce(
        mockDirectories as unknown as Awaited<ReturnType<typeof prisma.feedbackDirectory.findMany>>
      );

      const result = await getFeedbackDirectoriesByOrganizationId("org123");

      expect(result).toEqual(mockDirectories);
      expect(prisma.feedbackDirectory.findMany).toHaveBeenCalledWith({
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
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackDirectoriesByOrganizationId("org123");

      expect(result).toEqual([]);
      expect(prisma.feedbackDirectory.findMany).toHaveBeenCalledWith({
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
      vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(errToThrow);

      await expect(getFeedbackDirectoriesByOrganizationId("org123")).rejects.toThrow(DatabaseError);
    });

    test("bubbles up unexpected errors", async () => {
      const unexpectedError = new Error("Unexpected error");
      vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(unexpectedError);

      await expect(getFeedbackDirectoriesByOrganizationId("org123")).rejects.toThrow(unexpectedError);
    });
  });
});
