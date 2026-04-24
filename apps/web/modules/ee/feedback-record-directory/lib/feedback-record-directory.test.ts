import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createFeedbackRecordDirectory,
  getFeedbackRecordDirectories,
  getFeedbackRecordDirectoriesByWorkspaceId,
  getFeedbackRecordDirectoryAuthContext,
  getFeedbackRecordDirectoryDetails,
  getOrganizationIdFromDirectoryId,
  updateFeedbackRecordDirectory,
} from "./feedback-record-directory";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackRecordDirectory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    feedbackRecordDirectoryWorkspace: {
      findMany: vi.fn(),
    },
    workspace: {
      count: vi.fn(),
    },
    connector: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

const mockDirectoryId = "clj28r6va000409j3ep7h8xzk";
const mockOrganizationId = "clj28r6va000409j3ep7h8xyz";
const mockWorkspaceId1 = "clj28r6va000409j3ep7h8ab1";
const mockWorkspaceId2 = "clj28r6va000409j3ep7h8ab2";

const mockDirectoryDbRow = {
  id: mockDirectoryId,
  name: "Test Directory",
  isArchived: false,
  _count: { workspaces: 2, connectors: 1 },
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
  connectors: [],
};

describe("FeedbackRecordDirectory Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeedbackRecordDirectories", () => {
    test("returns directories with workspace counts", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockResolvedValueOnce([mockDirectoryDbRow] as any);

      const result = await getFeedbackRecordDirectories(mockOrganizationId);

      expect(result).toEqual([
        {
          id: mockDirectoryId,
          name: "Test Directory",
          isArchived: false,
          workspaceCount: 2,
          connectorCount: 1,
        },
      ]);
      expect(prisma.feedbackRecordDirectory.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        select: {
          id: true,
          name: true,
          isArchived: true,
          _count: { select: { workspaces: true, connectors: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns empty array when no directories exist", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackRecordDirectories(mockOrganizationId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackRecordDirectories(mockOrganizationId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected error");
      vi.mocked(prisma.feedbackRecordDirectory.findMany).mockRejectedValueOnce(error);

      await expect(getFeedbackRecordDirectories(mockOrganizationId)).rejects.toThrow(error);
    });
  });

  describe("getFeedbackRecordDirectoryDetails", () => {
    test("returns directory details with workspace assignments", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(
        mockDirectoryDetailsDbRow as any
      );

      const result = await getFeedbackRecordDirectoryDetails(mockDirectoryId);

      expect(result).toEqual({
        id: mockDirectoryId,
        name: "Test Directory",
        isArchived: false,
        organizationId: mockOrganizationId,
        workspaces: [
          { workspaceId: mockWorkspaceId1, workspaceName: "Workspace A" },
          { workspaceId: mockWorkspaceId2, workspaceName: "Workspace B" },
        ],
        connectors: [],
      });
    });

    test("returns directory details with connectors", async () => {
      const dbRowWithConnectors = {
        ...mockDirectoryDetailsDbRow,
        connectors: [
          {
            id: "conn-1",
            name: "My Connector",
            type: "formbricks",
            workspaceId: mockWorkspaceId1,
            workspace: { name: "Workspace A" },
          },
        ],
      };
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(dbRowWithConnectors as any);

      const result = await getFeedbackRecordDirectoryDetails(mockDirectoryId);

      expect(result?.connectors).toEqual([
        {
          id: "conn-1",
          name: "My Connector",
          type: "formbricks",
          workspaceId: mockWorkspaceId1,
          workspaceName: "Workspace A",
        },
      ]);
    });

    test("returns null when directory not found", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(null);

      const result = await getFeedbackRecordDirectoryDetails(mockDirectoryId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackRecordDirectoryDetails(mockDirectoryId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getFeedbackRecordDirectoryAuthContext", () => {
    test("returns slim auth context with workspace ids", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce({
        organizationId: mockOrganizationId,
        isArchived: false,
        workspaces: [{ workspaceId: mockWorkspaceId1 }, { workspaceId: mockWorkspaceId2 }],
      } as any);

      const result = await getFeedbackRecordDirectoryAuthContext(mockDirectoryId);

      expect(result).toEqual({
        organizationId: mockOrganizationId,
        workspaceIds: [mockWorkspaceId1, mockWorkspaceId2],
        isArchived: false,
      });
      expect(prisma.feedbackRecordDirectory.findUnique).toHaveBeenCalledWith({
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
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(null);

      const result = await getFeedbackRecordDirectoryAuthContext(mockDirectoryId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError when auth context lookup hits Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackRecordDirectoryAuthContext(mockDirectoryId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("createFeedbackRecordDirectory", () => {
    test("creates a directory and returns its ID", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.create).mockResolvedValueOnce({
        id: mockDirectoryId,
      } as any);

      const result = await createFeedbackRecordDirectory(mockOrganizationId, "New Directory");

      expect(result).toBe(mockDirectoryId);
      expect(prisma.feedbackRecordDirectory.create).toHaveBeenCalledWith({
        data: { name: "New Directory", organizationId: mockOrganizationId },
        select: { id: true },
      });
    });

    test("creates a directory with workspace links", async () => {
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.feedbackRecordDirectory.create).mockResolvedValueOnce({
        id: mockDirectoryId,
      } as any);

      const result = await createFeedbackRecordDirectory(mockOrganizationId, "With Workspaces", [
        mockWorkspaceId1,
        mockWorkspaceId2,
      ]);

      expect(result).toBe(mockDirectoryId);
      expect(prisma.workspace.count).toHaveBeenCalledWith({
        where: { id: { in: [mockWorkspaceId1, mockWorkspaceId2] }, organizationId: mockOrganizationId },
      });
      expect(prisma.feedbackRecordDirectory.create).toHaveBeenCalledWith({
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
        createFeedbackRecordDirectory(mockOrganizationId, "Bad Workspaces", [mockWorkspaceId1])
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_PROJECTS_INVALID_ORG"));
    });

    test("throws InvalidInputError on duplicate name (unique constraint violation)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.create).mockRejectedValueOnce(prismaError);

      await expect(createFeedbackRecordDirectory(mockOrganizationId, "Duplicate")).rejects.toThrow(
        new InvalidInputError("DIRECTORY_NAME_DUPLICATE")
      );
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.create).mockRejectedValueOnce(prismaError);

      await expect(createFeedbackRecordDirectory(mockOrganizationId, "Test")).rejects.toThrow(DatabaseError);
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected");
      vi.mocked(prisma.feedbackRecordDirectory.create).mockRejectedValueOnce(error);

      await expect(createFeedbackRecordDirectory(mockOrganizationId, "Test")).rejects.toThrow(error);
    });
  });

  describe("updateFeedbackRecordDirectory", () => {
    test("updates directory name", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, {
        name: "Updated Name",
      });

      expect(result).toBe(true);
      expect(prisma.feedbackRecordDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { name: "Updated Name" },
      });
    });

    test("archives directory when no connectors linked", async () => {
      vi.mocked(prisma.connector.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.feedbackRecordDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, {
        isArchived: true,
      });

      expect(result).toBe(true);
      expect(prisma.connector.count).toHaveBeenCalledWith({
        where: { feedbackRecordDirectoryId: mockDirectoryId },
      });
      expect(prisma.feedbackRecordDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { isArchived: true },
      });
    });

    test("throws InvalidInputError when archiving directory with connectors", async () => {
      vi.mocked(prisma.connector.count).mockResolvedValueOnce(2);

      await expect(
        updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, { isArchived: true })
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_HAS_CONNECTORS"));
    });

    test("unarchives directory", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.update).mockResolvedValueOnce({} as any);

      const result = await updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, {
        isArchived: false,
      });

      expect(result).toBe(true);
      expect(prisma.feedbackRecordDirectory.update).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        data: { isArchived: false },
      });
    });

    test("updates workspace assignments with diff", async () => {
      // getFeedbackRecordDirectoryDetails call
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(
        mockDirectoryDetailsDbRow as any
      );

      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.feedbackRecordDirectory.update).mockResolvedValueOnce({} as any);

      // Keep workspace1, remove workspace2 (by not including it)
      const result = await updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, {
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

    test("throws ResourceNotFoundError when directory does not exist (P2025)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, { name: "Test" })
      ).rejects.toThrow(ResourceNotFoundError);
    });

    test("throws InvalidInputError when workspaces belong to different org", async () => {
      // getFeedbackRecordDirectoryDetails call
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(
        mockDirectoryDetailsDbRow as any
      );

      // count returns 0 — none of the workspaces belong to this org
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(0);

      await expect(
        updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, {
          workspaceIds: [mockWorkspaceId1],
        })
      ).rejects.toThrow(new InvalidInputError("DIRECTORY_PROJECTS_INVALID_ORG"));
    });

    test("throws InvalidInputError on duplicate name (unique constraint violation)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, { name: "Duplicate" })
      ).rejects.toThrow(InvalidInputError);
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectory.update).mockRejectedValueOnce(prismaError);

      await expect(
        updateFeedbackRecordDirectory(mockDirectoryId, mockOrganizationId, { name: "Test" })
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe("getFeedbackRecordDirectoriesByWorkspaceId", () => {
    test("returns directories assigned to workspace", async () => {
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.findMany).mockResolvedValueOnce([
        { feedbackRecordDirectory: { id: mockDirectoryId, name: "Test Directory" } },
      ] as any);

      const result = await getFeedbackRecordDirectoriesByWorkspaceId(mockWorkspaceId1);

      expect(result).toEqual([{ id: mockDirectoryId, name: "Test Directory" }]);
      expect(prisma.feedbackRecordDirectoryWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId1,
          feedbackRecordDirectory: { isArchived: false },
        },
        select: {
          feedbackRecordDirectory: { select: { id: true, name: true } },
        },
      });
    });

    test("returns empty array when no directories assigned", async () => {
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.findMany).mockResolvedValueOnce([]);

      const result = await getFeedbackRecordDirectoriesByWorkspaceId(mockWorkspaceId1);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.findMany).mockRejectedValueOnce(prismaError);

      await expect(getFeedbackRecordDirectoriesByWorkspaceId(mockWorkspaceId1)).rejects.toThrow(
        DatabaseError
      );
    });

    test("re-throws unexpected errors", async () => {
      const error = new Error("Unexpected");
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.findMany).mockRejectedValueOnce(error);

      await expect(getFeedbackRecordDirectoriesByWorkspaceId(mockWorkspaceId1)).rejects.toThrow(error);
    });
  });

  describe("getOrganizationIdFromDirectoryId", () => {
    test("returns organization ID for a valid directory", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce({
        organizationId: mockOrganizationId,
      } as any);

      const result = await getOrganizationIdFromDirectoryId(mockDirectoryId);

      expect(result).toBe(mockOrganizationId);
      expect(prisma.feedbackRecordDirectory.findUnique).toHaveBeenCalledWith({
        where: { id: mockDirectoryId },
        select: { organizationId: true },
      });
    });

    test("throws ResourceNotFoundError when directory does not exist", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findUnique).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromDirectoryId(mockDirectoryId)).rejects.toThrow(ResourceNotFoundError);
    });
  });
});
