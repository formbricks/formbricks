import { cache } from "@/lib/cache";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TProjectWithLanguages } from "@/modules/survey/list/types/surveys";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { getProjectWithLanguagesByEnvironmentId, getUserProjects } from "./project";

vi.mock("@/lib/cache", () => ({
  cache: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/project/cache", () => ({
  projectCache: {
    tag: {
      byEnvironmentId: vi.fn((id) => `environment-${id}`),
      byUserId: vi.fn((id) => `user-${id}`),
      byOrganizationId: vi.fn((id) => `organization-${id}`),
    },
  },
}));

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

describe("Project module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getProjectWithLanguagesByEnvironmentId", () => {
    test("should return project with languages when successful", async () => {
      const mockProject: TProjectWithLanguages = {
        id: "project-id",
        languages: [
          { alias: "en", code: "English" },
          { alias: "es", code: "Spanish" },
        ],
      };

      vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(mockProject);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      const result = await getProjectWithLanguagesByEnvironmentId("env-id");

      expect(result).toEqual(mockProject);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
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
      expect(cache).toHaveBeenCalledWith(
        expect.any(Function),
        ["survey-list-getProjectByEnvironmentId-env-id"],
        {
          tags: ["environment-env-id"],
        }
      );
    });

    test("should return null when no project is found", async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      const result = await getProjectWithLanguagesByEnvironmentId("env-id");

      expect(result).toBeNull();
    });

    test("should handle DatabaseError when Prisma throws known request error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        clientVersion: "1.0.0",
        code: "P2002",
      });

      vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(prismaError);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      await expect(getProjectWithLanguagesByEnvironmentId("env-id")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");

      vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(error);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      await expect(getProjectWithLanguagesByEnvironmentId("env-id")).rejects.toThrow("Unknown error");
    });
  });

  describe("getUserProjects", () => {
    test("should return user projects for manager role", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "manager",
      };

      const mockProjects: TUserProject[] = [
        {
          id: "project-1",
          name: "Project 1",
          environments: [
            { id: "env-1", type: "production" },
            { id: "env-2", type: "development" },
          ],
        },
      ];

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership);
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      const result = await getUserProjects("user-id", "org-id");

      expect(result).toEqual(mockProjects);
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-id",
          organizationId: "org-id",
        },
      });
      expect(prisma.project.findMany).toHaveBeenCalledWith({
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
      expect(cache).toHaveBeenCalledWith(
        expect.any(Function),
        ["survey-list-getUserProjects-user-id-org-id"],
        {
          tags: ["user-user-id", "organization-org-id"],
        }
      );
    });

    test("should return user projects for member role with project team filter", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "member",
      };

      const mockProjects: TUserProject[] = [
        {
          id: "project-1",
          name: "Project 1",
          environments: [{ id: "env-1", type: "production" }],
        },
      ];

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership);
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      const result = await getUserProjects("user-id", "org-id");

      expect(result).toEqual(mockProjects);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-id",
          projectTeams: {
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
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      await expect(getUserProjects("user-id", "org-id")).rejects.toThrow(ValidationError);
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

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership);
      vi.mocked(prisma.project.findMany).mockRejectedValueOnce(prismaError);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      await expect(getUserProjects("user-id", "org-id")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const mockOrgMembership = {
        userId: "user-id",
        organizationId: "org-id",
        role: "admin",
      };

      const error = new Error("Unknown error");

      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce(mockOrgMembership);
      vi.mocked(prisma.project.findMany).mockRejectedValueOnce(error);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn());

      await expect(getUserProjects("user-id", "org-id")).rejects.toThrow("Unknown error");
    });
  });
});
