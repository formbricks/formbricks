import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { getProjectsByUserId } from "./project";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

describe("Project", () => {
  describe("getUserProjects", () => {
    const mockAdminMembership: TMembership = {
      role: "manager",
      organizationId: "org1",
      userId: "user1",
      accepted: true,
    };

    const mockMemberMembership: TMembership = {
      role: "member",
      organizationId: "org1",
      userId: "user1",
      accepted: true,
    };

    test("should return projects for admin role", async () => {
      const mockProjects = [
        { id: "project1", name: "Project 1" },
        { id: "project2", name: "Project 2" },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await getProjectsByUserId("user1", mockAdminMembership);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockProjects);
    });

    test("should return projects for member role with team restrictions", async () => {
      const mockProjects = [{ id: "project1", name: "Project 1" }];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await getProjectsByUserId("user1", mockMemberMembership);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
          projectTeams: {
            some: {
              team: {
                teamUsers: {
                  some: {
                    userId: "user1",
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
      expect(result).toEqual(mockProjects);
    });

    test("should return empty array when no projects found", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const result = await getProjectsByUserId("user1", mockAdminMembership);

      expect(result).toEqual([]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.project.findMany).mockRejectedValue(prismaError);

      await expect(getProjectsByUserId("user1", mockAdminMembership)).rejects.toThrow(
        new DatabaseError("Database error")
      );
    });

    test("should re-throw unknown errors", async () => {
      const unknownError = new Error("Unknown error");
      vi.mocked(prisma.project.findMany).mockRejectedValue(unknownError);

      await expect(getProjectsByUserId("user1", mockAdminMembership)).rejects.toThrow(unknownError);
    });

    test("should validate inputs correctly", async () => {
      await expect(getProjectsByUserId(123 as any, mockAdminMembership)).rejects.toThrow();
    });

    test("should validate membership input correctly", async () => {
      const invalidMembership = {} as TMembership;
      await expect(getProjectsByUserId("user1", invalidMembership)).rejects.toThrow();
    });

    test("should handle owner role like manager", async () => {
      const mockOwnerMembership: TMembership = {
        role: "owner",
        organizationId: "org1",
        userId: "user1",
        accepted: true,
      };

      const mockProjects = [{ id: "project1", name: "Project 1" }];
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await getProjectsByUserId("user1", mockOwnerMembership);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockProjects);
    });
  });
});
