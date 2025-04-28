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
  const mockEnvironmentIds = ["env1", "env2"];
  const mockActionClasses = [
    {
      id: "action1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Action 1",
      description: "Test Description 1",
      type: "click",
      key: "test-key-1",
      noCodeConfig: {},
      environmentId: "env1",
    },
    {
      id: "action2",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Action 2",
      description: "Test Description 2",
      type: "pageview",
      key: "test-key-2",
      noCodeConfig: {},
      environmentId: "env2",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully fetches action classes for given environment IDs", async () => {
    // Mock the prisma findMany response
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue(mockActionClasses);

    const result = await getActionClasses(mockEnvironmentIds);

    expect(result).toEqual(mockActionClasses);
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: {
        environmentId: { in: mockEnvironmentIds },
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

    await expect(getActionClasses(mockEnvironmentIds)).rejects.toThrow(DatabaseError);
  });

  test("handles empty environment IDs array", async () => {
    // Mock the prisma findMany response
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue([]);

    const result = await getActionClasses([]);

    expect(result).toEqual([]);
    expect(prisma.actionClass.findMany).toHaveBeenCalledWith({
      where: {
        environmentId: { in: [] },
      },
      select: expect.any(Object),
      orderBy: {
        createdAt: "asc",
      },
    });
  });
});
