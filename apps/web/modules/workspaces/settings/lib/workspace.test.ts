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
      const result = await createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1"] });
      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspace.create).toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).toHaveBeenCalled();
    });

    test("creates workspace without teams", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p3" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      const result = await createWorkspace("org1", { name: "Workspace No Teams" });
      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspace.create).toHaveBeenCalled();
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
