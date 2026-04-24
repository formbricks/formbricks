import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { deleteFilesByWorkspaceId } from "@/modules/storage/service";
import { createWorkspace, deleteWorkspace, updateWorkspace } from "./workspace";

vi.mock("server-only", () => ({}));

const baseWorkspace = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Workspace 1",
  appSetupCompleted: false,
  organizationId: "org1",
  languages: [],
  recontactDays: 0,
  linkSurveyBranding: false,
  inAppSurveyBranding: false,
  config: { channel: null, industry: null },
  placement: "bottomRight",
  clickOutsideClose: false,
  overlay: "none",
  styling: { allowStyleOverwrite: true },
  logo: null,
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    workspaceTeam: {
      createMany: vi.fn(),
    },
    feedbackRecordDirectory: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    feedbackRecordDirectoryWorkspace: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFilesByWorkspaceId: vi.fn(),
}));

describe("workspace lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateWorkspace", () => {
    test("updates workspace and revalidates cache", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(baseWorkspace as any);
      const result = await updateWorkspace("p1", {
        name: "Workspace 1",
      });
      expect(result).toEqual(baseWorkspace);
      expect(prisma.workspace.update).toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.workspace.update).mockRejectedValueOnce(
        new (class extends Error {
          constructor() {
            super();
            this.message = "fail";
          }
        })()
      );
      await expect(updateWorkspace("p1", { name: "Workspace 1" })).rejects.toThrow();
    });

    test("returns workspace data without Zod validation", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce({ ...baseWorkspace, id: 123 } as any);
      const result = await updateWorkspace("p1", { name: "Workspace 1" });
      expect(result).toEqual({ ...baseWorkspace, id: 123 });
    });
  });

  describe("createWorkspace", () => {
    test("creates workspace and revalidates cache", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p2" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.workspaceTeam.createMany).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.feedbackRecordDirectory.upsert).mockResolvedValueOnce({ id: "frd-1" } as any);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.create).mockResolvedValueOnce({} as any);
      const result = await createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1"] });
      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspace.create).toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).toHaveBeenCalled();
      expect(prisma.feedbackRecordDirectory.upsert).toHaveBeenCalled();
    });

    test("creates workspace and links default FRD when first workspace", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p3" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.feedbackRecordDirectory.upsert).mockResolvedValueOnce({ id: "frd-1" } as any);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.create).mockResolvedValueOnce({} as any);

      await createWorkspace("org1", { name: "Workspace No Teams" });

      expect(prisma.feedbackRecordDirectory.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_name: { organizationId: "org1", name: "Default Feedback Record Directory" },
        },
        create: { name: "Default Feedback Record Directory", organizationId: "org1" },
        update: {},
        select: { id: true },
      });
      expect(prisma.feedbackRecordDirectoryWorkspace.count).toHaveBeenCalledWith({
        where: { feedbackRecordDirectoryId: "frd-1" },
      });
      expect(prisma.feedbackRecordDirectoryWorkspace.create).toHaveBeenCalledWith({
        data: { feedbackRecordDirectoryId: "frd-1", workspaceId: "p3" },
      });
    });

    test("creates workspace and links selected feedback directory when provided", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p-selected" };
      vi.mocked(prisma.feedbackRecordDirectory.findFirst).mockResolvedValueOnce({
        id: "frd-selected",
      } as any);
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.create).mockResolvedValueOnce({} as any);

      const result = await createWorkspace("org1", {
        name: "Workspace with Selected Directory",
        feedbackRecordDirectoryId: "frd-selected",
      });

      expect(result).toEqual(createdWorkspace);
      expect(prisma.feedbackRecordDirectory.findFirst).toHaveBeenCalledWith({
        where: {
          id: "frd-selected",
          organizationId: "org1",
          isArchived: false,
        },
        select: { id: true },
      });
      expect(prisma.feedbackRecordDirectoryWorkspace.create).toHaveBeenCalledWith({
        data: { feedbackRecordDirectoryId: "frd-selected", workspaceId: "p-selected" },
      });
      expect(prisma.feedbackRecordDirectory.upsert).not.toHaveBeenCalled();
    });

    test("skips FRD link when default FRD already has links", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p4" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.feedbackRecordDirectory.upsert).mockResolvedValueOnce({ id: "frd-1" } as any);
      vi.mocked(prisma.feedbackRecordDirectoryWorkspace.count).mockResolvedValueOnce(1);

      await createWorkspace("org1", { name: "Second Workspace" });

      expect(prisma.feedbackRecordDirectoryWorkspace.create).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError when selected feedback directory is invalid", async () => {
      vi.mocked(prisma.feedbackRecordDirectory.findFirst).mockResolvedValueOnce(null);

      await expect(
        createWorkspace("org1", {
          name: "Workspace with Invalid Directory",
          feedbackRecordDirectoryId: "frd-missing",
        })
      ).rejects.toThrow(InvalidInputError);

      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    test("throws ValidationError if name is missing", async () => {
      await expect(createWorkspace("org1", {})).rejects.toThrow(ValidationError);
    });

    test("throws InvalidInputError on unique constraint", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(prismaError);
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow(InvalidInputError);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(prismaError);
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(new Error("fail"));
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow("fail");
    });
  });

  describe("deleteWorkspace", () => {
    test("deletes workspace, deletes files, and revalidates cache", async () => {
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(baseWorkspace as any);

      vi.mocked(deleteFilesByWorkspaceId).mockResolvedValue({ ok: true, data: undefined });
      const result = await deleteWorkspace("p1");
      expect(result).toEqual(baseWorkspace);
      expect(deleteFilesByWorkspaceId).toHaveBeenCalledWith("p1", []);
    });

    test("logs error if file deletion fails", async () => {
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(baseWorkspace as any);
      vi.mocked(deleteFilesByWorkspaceId).mockResolvedValue({
        ok: false,
        error: { code: StorageErrorCode.Unknown },
      } as any);
      vi.mocked(logger.error).mockImplementation(() => {});
      await deleteWorkspace("p1");
      expect(logger.error).toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.delete).mockRejectedValueOnce(err as any);
      await expect(deleteWorkspace("p1")).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.workspace.delete).mockRejectedValueOnce(new Error("fail"));
      await expect(deleteWorkspace("p1")).rejects.toThrow("fail");
    });
  });
});
