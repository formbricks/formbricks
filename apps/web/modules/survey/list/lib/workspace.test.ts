import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { TWorkspaceWithLanguages } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { doesWorkspaceExist, getUserWorkspaces, getWorkspace, getWorkspaceWithLanguages } from "./workspace";

vi.mock("@/lib/utils/validate");

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("react", async () => {
  const actualReact = await vi.importActual("react");
  return {
    ...actualReact,
    cache: vi.fn((fnToMemoize: (...args: any[]) => any) => fnToMemoize),
  };
});

const mockWorkspaceId = "clxko31qt000108jyd64v5688";

describe("doesWorkspaceExist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return workspaceId if workspace exists", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ id: mockWorkspaceId } as Awaited<
      ReturnType<typeof prisma.workspace.findUnique>
    >);

    const result = await doesWorkspaceExist(mockWorkspaceId);

    expect(result).toBe(mockWorkspaceId);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should throw ResourceNotFoundError if workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(doesWorkspaceExist(mockWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });
});

describe("getWorkspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return workspace if it exists", async () => {
    const mockData = { id: mockWorkspaceId };
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
      mockData as Awaited<ReturnType<typeof prisma.workspace.findUnique>>
    );

    const result = await getWorkspace(mockWorkspaceId);

    expect(result).toEqual(mockData);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should return null if workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await getWorkspace(mockWorkspaceId);
    expect(result).toBeNull();
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspace(mockWorkspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error fetching workspace");
  });

  test("should re-throw error if a generic error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(genericError);

    await expect(getWorkspace(mockWorkspaceId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("Workspace module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getWorkspaceWithLanguages", () => {
    test("should return workspace with languages when successful", async () => {
      const mockWorkspace: TWorkspaceWithLanguages = {
        id: "workspace-id",
        languages: [{ language: { id: "lang-1", code: "en" } }],
      } as any;

      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);

      const result = await getWorkspaceWithLanguages("workspace-id");

      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: {
          id: "workspace-id",
        },
        select: {
          id: true,
          languages: true,
        },
      });
    });

    test("should return null when no workspace is found", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(null);

      const result = await getWorkspaceWithLanguages("workspace-id");

      expect(result).toBeNull();
    });

    test("should handle DatabaseError when Prisma throws known request error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        clientVersion: "1.0.0",
        code: "P2002",
      });

      vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getWorkspaceWithLanguages("workspace-id")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");

      vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(error);

      await expect(getWorkspaceWithLanguages("workspace-id")).rejects.toThrow("Unknown error");
    });
  });

  describe("getUserWorkspaces", () => {
    test("should return user workspaces for manager role", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "manager",
      };

      const mockWorkspaces: TUserWorkspace[] = [
        { id: "workspace-1", name: "Workspace 1" },
        { id: "workspace-2", name: "Workspace 2" },
      ] as any;

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership as any);
      vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce(mockWorkspaces as any);

      const result = await getUserWorkspaces("user-id", "org-id");

      expect(result).toEqual(mockWorkspaces);
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-id",
          organizationId: "org-id",
        },
      });
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-id",
        },
        select: {
          id: true,
          name: true,
        },
      });
    });

    test("should return user workspaces for member role with workspace team filter", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "member",
      };

      const mockWorkspaces: TUserWorkspace[] = [
        { id: "workspace-1", name: "Workspace 1" },
        { id: "workspace-2", name: "Workspace 2" },
      ] as any;

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership as any);
      vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce(mockWorkspaces as any);

      const result = await getUserWorkspaces("user-id", "org-id");

      expect(result).toEqual(mockWorkspaces);
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-id",
          workspaceTeams: {
            some: {
              team: {
                teamUsers: {
                  some: {
                    userId: "user-id",
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });
    });

    test("should throw ValidationError when user is not a member of the organization", async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(null);

      await expect(getUserWorkspaces("user-id", "org-id")).rejects.toThrow(ValidationError);
    });

    test("should handle DatabaseError when Prisma throws known request error", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "admin",
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        clientVersion: "1.0.0",
        code: "P2002",
      });

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership as any);
      vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(prismaError);

      await expect(getUserWorkspaces("user-id", "org-id")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "admin",
      };

      const error = new Error("Unknown error");

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership as any);
      vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(error);

      await expect(getUserWorkspaces("user-id", "org-id")).rejects.toThrow("Unknown error");
    });
  });
});
