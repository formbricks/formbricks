import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOrganizationWorkspace } from "../types/api-keys";
import { getWorkspacesByOrganizationId } from "./workspaces";

// Mock organization workspace data
const mockWorkspaces: TOrganizationWorkspace[] = [
  {
    id: "workspace1",
    name: "Workspace 1",
    environments: [
      {
        id: "env1",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "workspace1",
        appSetupCompleted: true,
      },
      {
        id: "env2",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "workspace1",
        appSetupCompleted: true,
      },
    ],
  },
  {
    id: "workspace2",
    name: "Workspace 2",
    environments: [
      {
        id: "env3",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "workspace2",
        appSetupCompleted: true,
      },
    ],
  },
];

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
    },
  },
}));

describe("Workspaces Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspacesByOrganizationId", () => {
    test("retrieves workspaces by organization ID successfully", async () => {
      vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce(
        mockWorkspaces as unknown as Awaited<ReturnType<typeof prisma.workspace.findMany>>
      );

      const result = await getWorkspacesByOrganizationId("org123");

      expect(result).toEqual(mockWorkspaces);
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
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

    test("returns empty array when no workspaces exist", async () => {
      vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce([]);

      const result = await getWorkspacesByOrganizationId("org123");

      expect(result).toEqual([]);
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
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
      vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(errToThrow);

      await expect(getWorkspacesByOrganizationId("org123")).rejects.toThrow(DatabaseError);
    });

    test("bubbles up unexpected errors", async () => {
      const unexpectedError = new Error("Unexpected error");
      vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(unexpectedError);

      await expect(getWorkspacesByOrganizationId("org123")).rejects.toThrow(unexpectedError);
    });
  });
});
