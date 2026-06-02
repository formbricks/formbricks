import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createFeedbackDirectory,
  getFeedbackDirectories,
  getFeedbackDirectoriesByWorkspaceId,
  getFeedbackDirectoryAuthContext,
  getFeedbackDirectoryDetails,
  getOrganizationIdFromDirectoryId,
  getWorkspaceFeedbackDirectoryAccess,
  updateFeedbackDirectory,
} from "./feedback-directory";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => {
  const prismaMock = {
    feedbackDirectory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    feedbackDirectoryWorkspace: {
      findMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    workspace: {
      count: vi.fn(),
    },
    feedbackSource: {
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
  };
  return { prisma: prismaMock };
});

const mockDirectoryId = "clj28r6va000409j3ep7h8xzk";
const mockOrganizationId = "clj28r6va000409j3ep7h8xyz";
const mockWorkspaceId1 = "clj28r6va000409j3ep7h8ab1";
const mockWorkspaceId2 = "clj28r6va000409j3ep7h8ab2";

const mockDirectoryDbRow = {
  id: mockDirectoryId,
  name: "Test Directory",
  isArchived: false,
  _count: { workspaces: 2, feedbackSources: 1 },
};

const mockDirectoryDetailsDbRow = {
  id: mockDirectoryId,
  name: "Test Directory",
  isArchived: false,
  organizationId: mockOrganizationId,
  workspaces: [
    { workspaceId: mockWorkspaceId1, workspace: { name: "Workspace A" } },
    { workspaceId: mockWorkspaceId2, workspace: { name: "Workspace B" } },
  ],
  feedbackSources: [],
};

describe("FeedbackDirectory Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeedbackDirectories", () => {
    test("returns directories with workspace counts", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValueOnce([mockDirectoryDbRow] as any);

      const result = await getFeedbackDirectories(mockOrganizationId);

      expect(result).toEqual([
        {
          id: mockDirectoryId,
          name: "Test Directory",
          isArchived: false,
          workspaceCount: 2,
          feedbackSourceCount: 1,
        },
      ]);
      expect(prisma.feedbackDirectory.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        select: {
          id: true,
          name: true,
          isArchived: true,
          _count: { select: { workspaces: true, feedbackSources: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns empty array when no directories exist", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackDirectories(mockOrganizationId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackDirectories(mockOrganizationId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected error");
      vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(error);

      await expect(getFeedbackDirectories(mockOrganizationId)).rejects.toThrow(error);
    });
  });

  describe("getFeedbackDirectoryDetails", () => {
    test("returns directory details with workspace assignments", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);

      const result = await getFeedbackDirectoryDetails(mockDirectoryId);

      expect(result).toEqual({
        id: mockDirectoryId,
        name: "Test Directory",
        isArchived: false,
        organizationId: mockOrganizationId,
        workspaces: [
          { workspaceId: mockWorkspaceId1, workspaceName: "Workspace A" },
          { workspaceId: mockWorkspaceId2, workspaceName: "Workspace B" },
        ],
        feedbackSources: [],
      });
    });

    test("returns directory details with feedbackSources", async () => {
      const dbRowWithConnectors = {
        ...mockDirectoryDetailsDbRow,
        feedbackSources: [
          {
            id: "conn-1",
            name: "My Connector",
            type: "formbricks_survey",
            workspaceId: mockWorkspaceId1,
            workspace: { name: "Workspace A" },
          },
        ],
      };
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(dbRowWithConnectors as any);

      const result = await getFeedbackDirectoryDetails(mockDirectoryId);

      expect(result?.feedbackSources).toEqual([
        {
          id: "conn-1",
          name: "My Connector",
          type: "formbricks_survey",
          workspaceId: mockWorkspaceId1,
          workspaceName: "Workspace A",
        },
      ]);
    });

    test("returns null when directory not found", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(null);

      const result = await getFeedbackDirectoryDetails(mockDirectoryId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackDirectoryDetails(mockDirectoryId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getFeedbackDirectoryAuthContext", () => {
    test("returns slim auth context with workspace ids", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce({
        organizationId: mockOrganizationId,
        isArchived: false,
        workspaces: [{ workspaceId: mockWorkspaceId1 }, { workspaceId: mockWorkspaceId2 }],
      } as any);

      const result = await getFeedbackDirectoryAuthContext(mockDirectoryId);

      expect(result).toEqual({
        organizationId: mockOrganizationId,
        workspaceIds: [mockWorkspaceId1, mockWorkspaceId2],
        isArchived: false,
      });
      expect(prisma.feedbackDirectory.findUnique).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        select: {
          organizationId: true,
          isArchived: true,
          workspaces: {
            select: {
              workspaceId: true,
            },
          },
        },
      });
    });

    test("returns null when auth context directory is missing", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(null);

      const result = await getFeedbackDirectoryAuthContext(mockDirectoryId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError when auth context lookup hits Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackDirectoryAuthContext(mockDirectoryId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("createFeedbackDirectory", () => {
    test("creates a directory and returns its ID", async () => {
      vi.mocked(prisma.feedbackDirectory.create).mockResolvedValueOnce({
        id: mockDirectoryId,
      } as any);

      const result = await createFeedbackDirectory(mockOrganizationId, "New Directory");

      expect(result).toBe(mockDirectoryId);
      expect(prisma.feedbackDirectory.create).toHaveBeenCalledWith({
        data: { name: "New Directory", organizationId: mockOrganizationId },
        select: { id: true },
      });
    });

    test("creates a directory with workspace links", async () => {
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.feedbackDirectory.create).mockResolvedValueOnce({
        id: mockDirectoryId,
      } as any);

      const result = await createFeedbackDirectory(mockOrganizationId, "With Workspaces", [
        mockWorkspaceId1,
        mockWorkspaceId2,
      ]);

      expect(result).toBe(mockDirectoryId);
      expect(prisma.workspace.count).toHaveBeenCalledWith({
        where: { id: { in: [mockWorkspaceId1, mockWorkspaceId2] }, organizationId: mockOrganizationId },
      });
      expect(prisma.feedbackDirectory.create).toHaveBeenCalledWith({
        data: {
          name: "With Workspaces",
          organizationId: mockOrganizationId,
          workspaces: {
            create: [{ workspaceId: mockWorkspaceId1 }, { workspaceId: mockWorkspaceId2 }],
          },
        },
        select: { id: true },
      });
    });

    test("throws InvalidInputError when workspaceIds belong to different org", async () => {
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(0);

      await expect(
        createFeedbackDirectory(mockOrganizationId, "Bad Workspaces", [mockWorkspaceId1])
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_WORKSPACES_INVALID_ORG"));
    });

    test("throws InvalidInputError when a workspace is already assigned to another active directory", async () => {
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.feedbackDirectoryWorkspace.findFirst).mockResolvedValueOnce({
        workspaceId: mockWorkspaceId1,
      } as any);

      await expect(
        createFeedbackDirectory(mockOrganizationId, "Conflicting", [mockWorkspaceId1])
      ).rejects.toThrow(new InvalidInputError("WORKSPACE_ALREADY_ASSIGNED_TO_DIFFERENT_DIRECTORY"));

      expect(prisma.feedbackDirectoryWorkspace.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: { in: [mockWorkspaceId1] },
          feedbackDirectory: { isArchived: false },
        },
        select: { workspaceId: true },
      });
      expect(prisma.feedbackDirectory.create).not.toHaveBeenCalled();
    });

    test("allows creation when workspace is only assigned to archived directory", async () => {
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.feedbackDirectoryWorkspace.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.feedbackDirectory.create).mockResolvedValueOnce({
        id: mockDirectoryId,
      } as any);

      const result = await createFeedbackDirectory(mockOrganizationId, "ArchivedOnly", [mockWorkspaceId1]);

      expect(prisma.feedbackDirectoryWorkspace.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: { in: [mockWorkspaceId1] },
          feedbackDirectory: { isArchived: false },
        },
        select: { workspaceId: true },
      });

      expect(prisma.feedbackDirectory.create).toHaveBeenCalled();
      expect(result).toBe(mockDirectoryId);
    });

    test("throws InvalidInputError on duplicate name (unique constraint violation)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.create).mockRejectedValueOnce(prismaError);

      await expect(createFeedbackDirectory(mockOrganizationId, "Duplicate")).rejects.toThrow(
        new InvalidInputError("DIRECTORY_NAME_DUPLICATE")
      );
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.create).mockRejectedValueOnce(prismaError);

      await expect(createFeedbackDirectory(mockOrganizationId, "Test")).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected");
      vi.mocked(prisma.feedbackDirectory.create).mockRejectedValueOnce(error);

      await expect(createFeedbackDirectory(mockOrganizationId, "Test")).rejects.toThrow(error);
    });
  });

  describe("updateFeedbackDirectory", () => {
    test("updates directory name", async () => {
      vi.mocked(prisma.feedbackDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
        name: "Updated Name",
      });

      expect(result).toBe(true);
      expect(prisma.feedbackDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { name: "Updated Name" },
      });
    });

    test("archives directory when no feedbackSources linked", async () => {
      vi.mocked(prisma.feedbackSource.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.feedbackDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
        isArchived: true,
      });

      expect(result).toBe(true);
      expect(prisma.feedbackSource.count).toHaveBeenCalledWith({
        where: { feedbackDirectoryId: mockDirectoryId },
      });
      expect(prisma.feedbackDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { isArchived: true },
      });
    });

    test("throws InvalidInputError when archiving directory with feedbackSources", async () => {
      vi.mocked(prisma.feedbackSource.count).mockResolvedValueOnce(2);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, { isArchived: true })
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_HAS_FEEDBACK_SOURCES"));
    });

    test("unarchives directory", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);
      vi.mocked(prisma.feedbackDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
        isArchived: false,
      });

      expect(result).toBe(true);
      expect(prisma.feedbackDirectoryWorkspace.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: { in: [mockWorkspaceId1, mockWorkspaceId2] },
          feedbackDirectoryId: { not: mockDirectoryId },
          feedbackDirectory: { isArchived: false },
        },
        select: { workspaceId: true },
      });
      expect(prisma.feedbackDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { isArchived: false },
      });
    });

    test("throws ResourceNotFoundError when unarchiving and directory cannot be loaded", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(null);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
          isArchived: false,
        })
      ).rejects.toThrow(ResourceNotFoundError);

      expect(prisma.feedbackDirectoryWorkspace.findFirst).not.toHaveBeenCalled();
      expect(prisma.feedbackDirectory.update).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError when unarchiving would assign a workspace to two active directories", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);
      vi.mocked(prisma.feedbackDirectoryWorkspace.findFirst).mockResolvedValueOnce({
        workspaceId: mockWorkspaceId1,
      } as any);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
          isArchived: false,
        })
      ).rejects.toThrow(new InvalidInputError("WORKSPACE_ALREADY_ASSIGNED_TO_DIFFERENT_DIRECTORY"));

      expect(prisma.feedbackDirectory.update).not.toHaveBeenCalled();
    });

    test("updates workspace assignments with diff", async () => {
      // getFeedbackDirectoryDetails call
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);

      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.feedbackDirectory.update).mockResolvedValueOnce({} as any);

      // Keep workspace1, remove workspace2 (by not including it)
      const result = await updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
        workspaceIds: [mockWorkspaceId1],
      });

      expect(result).toBe(true);
      expect(prisma.workspace.count).toHaveBeenCalledWith({
        where: {
          id: { in: [mockWorkspaceId1] },
          organizationId: mockOrganizationId,
        },
      });
    });

    test("pauses feedbackSources in removed workspaces when requested", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.feedbackDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackDirectory(
        mockDirectoryId,
        mockOrganizationId,
        {
          workspaceIds: [mockWorkspaceId1],
        },
        { pauseFeedbackSourcesInRemovedWorkspaces: true }
      );

      expect(result).toBe(true);
      expect(prisma.feedbackSource.updateMany).toHaveBeenCalledWith({
        where: {
          feedbackDirectoryId: mockDirectoryId,
          workspaceId: { in: [mockWorkspaceId2] },
        },
        data: {
          status: "paused",
        },
      });
    });

    test("throws ResourceNotFoundError when directory does not exist (P2025)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, { name: "Test" })
      ).rejects.toThrow(ResourceNotFoundError);
    });

    test("throws InvalidInputError when workspaces belong to different org", async () => {
      // getFeedbackDirectoryDetails call
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(mockDirectoryDetailsDbRow as any);

      // count returns 0 — none of the workspaces belong to this org
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(0);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, {
          workspaceIds: [mockWorkspaceId1],
        })
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_WORKSPACES_INVALID_ORG"));
    });

    test("throws InvalidInputError on duplicate name (unique constraint violation)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, { name: "Duplicate" })
      ).rejects.toThrow(InvalidInputError);
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackDirectory(mockDirectoryId, mockOrganizationId, { name: "Test" })
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe("getFeedbackDirectoriesByWorkspaceId", () => {
    test("returns directories assigned to workspace", async () => {
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValueOnce([
        { feedbackDirectory: { id: mockDirectoryId, name: "Test Directory" } },
      ] as any);

      const result = await getFeedbackDirectoriesByWorkspaceId(mockWorkspaceId1);

      expect(result).toEqual([{ id: mockDirectoryId, name: "Test Directory" }]);
      expect(prisma.feedbackDirectoryWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId1,
          feedbackDirectory: { isArchived: false },
        },
        select: {
          feedbackDirectory: { select: { id: true, name: true } },
        },
      });
    });

    test("returns empty array when no directories assigned", async () => {
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackDirectoriesByWorkspaceId(mockWorkspaceId1);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackDirectoriesByWorkspaceId(mockWorkspaceId1)).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected");
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockRejectedValueOnce(error);

      await expect(getFeedbackDirectoriesByWorkspaceId(mockWorkspaceId1)).rejects.toThrow(error);
    });
  });

  describe("getWorkspaceFeedbackDirectoryAccess", () => {
    test("returns one active assignment per workspace with directory details", async () => {
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValueOnce([
        {
          workspaceId: mockWorkspaceId1,
          feedbackDirectory: { id: mockDirectoryId, name: "Directory A" },
        },
        {
          workspaceId: mockWorkspaceId1,
          feedbackDirectory: { id: "clj28r6va000409j3ep7h8xy2", name: "Directory B" },
        },
        {
          workspaceId: mockWorkspaceId2,
          feedbackDirectory: { id: "clj28r6va000409j3ep7h8xy3", name: "Directory C" },
        },
      ] as any);

      const result = await getWorkspaceFeedbackDirectoryAccess(mockOrganizationId);

      expect(result).toEqual([
        {
          workspaceId: mockWorkspaceId1,
          feedbackDirectoryId: mockDirectoryId,
          feedbackDirectoryName: "Directory A",
        },
        {
          workspaceId: mockWorkspaceId2,
          feedbackDirectoryId: "clj28r6va000409j3ep7h8xy3",
          feedbackDirectoryName: "Directory C",
        },
      ]);
      expect(prisma.feedbackDirectoryWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          feedbackDirectory: {
            organizationId: mockOrganizationId,
            isArchived: false,
          },
        },
        select: {
          workspaceId: true,
          feedbackDirectory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ workspaceId: "asc" }, { createdAt: "asc" }],
      });
    });

    test("returns empty array when no active access assignments exist", async () => {
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValueOnce([]);

      const result = await getWorkspaceFeedbackDirectoryAccess(mockOrganizationId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockRejectedValueOnce(prismaError);

      await expect(getWorkspaceFeedbackDirectoryAccess(mockOrganizationId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected");
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockRejectedValueOnce(error);

      await expect(getWorkspaceFeedbackDirectoryAccess(mockOrganizationId)).rejects.toThrow(error);
    });
  });

  describe("getOrganizationIdFromDirectoryId", () => {
    test("returns organization ID for a valid directory", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce({
        organizationId: mockOrganizationId,
      } as any);

      const result = await getOrganizationIdFromDirectoryId(mockDirectoryId);

      expect(result).toBe(mockOrganizationId);
      expect(prisma.feedbackDirectory.findUnique).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        select: { organizationId: true },
      });
    });

    test("throws ResourceNotFoundError when directory does not exist", async () => {
      vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromDirectoryId(mockDirectoryId)).rejects.toThrow(ResourceNotFoundError);
    });
  });
});
