import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
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
    feedbackDirectory: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    feedbackDirectoryWorkspace: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const expectNoFrdSideEffects = () => {
  expect(prisma.feedbackDirectory.upsert).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectory.findFirst).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectoryWorkspace.count).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectoryWorkspace.create).not.toHaveBeenCalled();
};

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

    // ENG-1919: a workspace must not be moved to another organization via update.
    test("never persists a caller-supplied organizationId", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(baseWorkspace as any);
      await updateWorkspace("p1", { name: "Workspace 1", organizationId: "attacker-target-org" });
      const arg = vi.mocked(prisma.workspace.update).mock.calls[0][0];
      expect(arg.data).not.toHaveProperty("organizationId");
    });
  });

  describe("createWorkspace", () => {
    test("creates workspace with team links and no FRD side-effects", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p2" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.workspaceTeam.createMany).mockResolvedValueOnce({} as any);

      const result = await createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1"] });

      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspace.create).toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).toHaveBeenCalled();
      expectNoFrdSideEffects();
    });

    test("seeds English as the default survey language when creating a workspace", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p-language" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Workspace language" });

      const createArgs = vi.mocked(prisma.workspace.create).mock.calls[0][0];
      expect((createArgs.data as any).languages.create).toEqual([{ code: "en-US", alias: null }]);
    });

    test("seeds the default contact attribute keys when creating a workspace", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p-defaults" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Workspace defaults" });

      const createArgs = vi.mocked(prisma.workspace.create).mock.calls[0][0];
      const attributeCreate = (createArgs.data as any).contactAttributeKeys.create as Array<{
        key: string;
        type: string;
        isUnique?: boolean;
      }>;
      expect(attributeCreate.map((a) => a.key).sort()).toEqual(
        ["email", "firstName", "language", "lastName", "userId"].sort()
      );
      expect(attributeCreate.every((a) => a.type === "default")).toBe(true);
      const uniqueKeys = attributeCreate.filter((a) => a.isUnique).map((a) => a.key);
      expect(uniqueKeys.sort()).toEqual(["email", "userId"].sort());
    });

    test("creates workspace without teams and does not auto-link any FRD", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p3" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      const result = await createWorkspace("org1", { name: "Workspace No Teams" });

      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspaceTeam.createMany).not.toHaveBeenCalled();
      expectNoFrdSideEffects();
    });

    test("does not upsert a Default Feedback Directory under any flow", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p4" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Second Workspace" });

      expect(prisma.feedbackDirectory.upsert).not.toHaveBeenCalled();
      expect(prisma.feedbackDirectoryWorkspace.create).not.toHaveBeenCalled();
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
