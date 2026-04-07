import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getActionClasses } from "./action-classes";

// Mock the prisma client
vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findMany: vi.fn(),
    },
  },
}));

describe("getActionClasses", () => {
  const mockWorkspaceIds = ["ws1", "ws2"];
  const mockActionClasses = [
    {
      id: "action1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Action 1",
      description: "Test Description 1" as string | null,
      type: "code" as const,
      key: "test-key-1" as string | null,
      noCodeConfig: {},
      environmentId: "env1",
    },
    {
      id: "action2",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Action 2",
      description: "Test Description 2" as string | null,
      type: "noCode" as const,
      key: "test-key-2" as string | null,
      noCodeConfig: {},
      environmentId: "env2",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully fetches action classes for given workspace IDs", async () => {
    // Mock the prisma findMany response
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);

    const result = await getActionClasses(mockWorkspaceIds);

    expect(result).toEqual(mockActionClasses);
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: { in: mockWorkspaceIds },
      },
      select: expect.any(Object),
      orderBy: {
        createdAt: "asc",
      },
    });
  });

  test("throws DatabaseError when prisma query fails", async () => {
    // Mock the prisma findMany to throw an error
    vi.mocked(prisma.actionClass.findMany).mockRejectedValue(new Error("Database error"));

    await expect(getActionClasses(mockWorkspaceIds)).rejects.toThrow(DatabaseError);
  });

  test("handles empty workspace IDs array", async () => {
    // Mock the prisma findMany response
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue([]);

    const result = await getActionClasses([]);

    expect(result).toEqual([]);
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: { in: [] },
      },
      select: expect.any(Object),
      orderBy: {
        createdAt: "asc",
      },
    });
  });
});
