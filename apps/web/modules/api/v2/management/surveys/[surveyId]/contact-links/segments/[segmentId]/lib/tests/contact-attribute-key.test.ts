import { getContactAttributeKeys } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact-attribute-key";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
    },
  },
}));

describe("getContactAttributeKeys", () => {
  const mockEnvironmentId = "mock-env-123";
  const mockContactAttributeKeys = [{ key: "email" }, { key: "name" }, { key: "userId" }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully retrieves contact attribute keys", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockContactAttributeKeys);

    const result = await getContactAttributeKeys(mockEnvironmentId);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { environmentId: mockEnvironmentId },
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

    const result = await getContactAttributeKeys(mockEnvironmentId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "contact attribute keys", issue: mockError.message }],
      });
    }
  });
});
