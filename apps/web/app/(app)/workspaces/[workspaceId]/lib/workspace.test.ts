import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { getWorkspacesByUserId } from "./workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
    },
  },
}));

describe("Workspace", () => {
  describe("getUserWorkspaces", () => {
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

    test("should return workspaces for admin role", async () => {
      const mockWorkspaces = [
        { id: "workspace1", name: "Workspace 1" },
        { id: "workspace2", name: "Workspace 2" },
      ];

      vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as any);

      const result = await getWorkspacesByUserId("user1", mockAdminMembership);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockWorkspaces);
    });

    test("should return workspaces for member role with team restrictions", async () => {
      const mockWorkspaces = [{ id: "workspace1", name: "Workspace 1" }];

      vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as any);

      const result = await getWorkspacesByUserId("user1", mockMemberMembership);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
          workspaceTeams: {
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
      expect(result).toEqual(mockWorkspaces);
    });

    test("should return empty array when no workspaces found", async () => {
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

      const result = await getWorkspacesByUserId("user1", mockAdminMembership);

      expect(result).toEqual([]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.workspace.findMany).mockRejectedValue(prismaError);

      await expect(getWorkspacesByUserId("user1", mockAdminMembership)).rejects.toThrow(
        new DatabaseError("Database error")
      );
    });

    test("should re-throw unknown errors", async () => {
      const unknownError = new Error("Unknown error");
      vi.mocked(prisma.workspace.findMany).mockRejectedValue(unknownError);

      await expect(getWorkspacesByUserId("user1", mockAdminMembership)).rejects.toThrow(unknownError);
    });

    test("should validate inputs correctly", async () => {
      await expect(getWorkspacesByUserId(123 as any, mockAdminMembership)).rejects.toThrow();
    });

    test("should validate membership input correctly", async () => {
      const invalidMembership = {} as TMembership;
      await expect(getWorkspacesByUserId("user1", invalidMembership)).rejects.toThrow();
    });

    test("should handle owner role like manager", async () => {
      const mockOwnerMembership: TMembership = {
        role: "owner",
        organizationId: "org1",
        userId: "user1",
        accepted: true,
      };

      const mockWorkspaces = [{ id: "workspace1", name: "Workspace 1" }];
      vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as any);

      const result = await getWorkspacesByUserId("user1", mockOwnerMembership);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org1",
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockWorkspaces);
    });
  });
});
