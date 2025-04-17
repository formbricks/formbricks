import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { projectCache } from "@formbricks/lib/project/cache";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationProject } from "../types/api-keys";
import { getProjectsByOrganizationId } from "./projects";

// Mock organization project data
const mockProjects: TOrganizationProject[] = [
  {
    id: "project1",
    name: "Project 1",
    environments: [
      {
        id: "env1",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
      {
        id: "env2",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
    ],
  },
  {
    id: "project2",
    name: "Project 2",
    environments: [
      {
        id: "env3",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project2",
        appSetupCompleted: true,
      },
    ],
  },
];

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/lib/project/cache", () => ({
  projectCache: {
    tag: {
      byOrganizationId: vi.fn(),
    },
  },
}));

describe("Projects Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProjectsByOrganizationId", () => {
    test("retrieves projects by organization ID successfully", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);
      vi.mocked(projectCache.tag.byOrganizationId).mockReturnValue("org-tag");

      const result = await getProjectsByOrganizationId("org123");

      expect(result).toEqual(mockProjects);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org123",
        },
        select: {
          id: true,
          environments: true,
          name: true,
        },
      });
    });

    test("returns empty array when no projects exist", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValueOnce([]);
      vi.mocked(projectCache.tag.byOrganizationId).mockReturnValue("org-tag");

      const result = await getProjectsByOrganizationId("org123");

      expect(result).toEqual([]);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org123",
        },
        select: {
          id: true,
          environments: true,
          name: true,
        },
      });
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.project.findMany).mockRejectedValueOnce(errToThrow);
      vi.mocked(projectCache.tag.byOrganizationId).mockReturnValue("org-tag");

      await expect(getProjectsByOrganizationId("org123")).rejects.toThrow(DatabaseError);
    });

    test("bubbles up unexpected errors", async () => {
      const unexpectedError = new Error("Unexpected error");
      vi.mocked(prisma.project.findMany).mockRejectedValueOnce(unexpectedError);
      vi.mocked(projectCache.tag.byOrganizationId).mockReturnValue("org-tag");

      await expect(getProjectsByOrganizationId("org123")).rejects.toThrow(unexpectedError);
    });
  });
});
