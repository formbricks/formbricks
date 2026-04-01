import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { TWorkspaceWithLanguages } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { getUserWorkspaces, getWorkspaceWithLanguagesByEnvironmentId } from "./workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Workspace module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getWorkspaceWithLanguagesByEnvironmentId", () => {
    test("should return workspace with languages when successful", async () => {
      const mockWorkspace: TWorkspaceWithLanguages = {
        id: "workspace-id",
        languages: [{ language: { id: "lang-1", code: "en" } }],
      } as any;

      vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(mockWorkspace as any);

      const result = await getWorkspaceWithLanguagesByEnvironmentId("env-id");

      expect(result).toEqual(mockWorkspace);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: {
          environments: {
            some: {
              id: "env-id",
            },
          },
        },
        select: {
          id: true,
          languages: true,
        },
      });
    });

    test("should return null when no workspace is found", async () => {
      vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(null);

      const result = await getWorkspaceWithLanguagesByEnvironmentId("env-id");

      expect(result).toBeNull();
    });

    test("should handle DatabaseError when Prisma throws known request error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        clientVersion: "1.0.0",
        code: "P2002",
      });

      vi.mocked(prisma.workspace.findFirst).mockRejectedValueOnce(prismaError);

      await expect(getWorkspaceWithLanguagesByEnvironmentId("env-id")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");

      vi.mocked(prisma.workspace.findFirst).mockRejectedValueOnce(error);

      await expect(getWorkspaceWithLanguagesByEnvironmentId("env-id")).rejects.toThrow("Unknown error");
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
          environments: {
            select: {
              id: true,
              type: true,
            },
          },
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
          environments: {
            select: {
              id: true,
              type: true,
            },
          },
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
