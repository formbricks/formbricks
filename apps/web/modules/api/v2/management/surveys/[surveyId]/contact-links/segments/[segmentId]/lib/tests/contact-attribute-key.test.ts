import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactAttributeKeys } from "../contact-attribute-key";

vi.mock("react", () => ({
  cache: vi.fn((fn: Function) => fn),
}));

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
    },
  },
}));

describe("getContactAttributeKeys", () => {
  const mockWorkspaceId = "mock-ws-123";
  const mockContactAttributeKeys = [{ key: "email" }, { key: "name" }, { key: "userId" }] as Awaited<
    ReturnType<typeof prisma.contactAttributeKey.findMany>
  >;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully retrieves contact attribute keys", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockContactAttributeKeys);

    const result = await getContactAttributeKeys(mockWorkspaceId);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { workspaceId: mockWorkspaceId },
      select: { key: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(["email", "name", "userId"]);
    }
  });

  test("handles database error gracefully", async () => {
    const mockError = new Error("Database error");
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(mockError);

    const result = await getContactAttributeKeys(mockWorkspaceId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "contact attribute keys", issue: mockError.message }],
      });
    }
  });
});
