import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getIsEmailUnique } from "./user";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const mockPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);

describe("User Library Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getIsEmailUnique", () => {
    const email = "test@example.com";

    test("should return false if user exists", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        id: "some-user-id",
      } as any);

      const result = await getIsEmailUnique(email);
      expect(result).toBe(false);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { email },
        select: { id: true },
      });
    });

    test("should return true if user does not exist", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const result = await getIsEmailUnique(email);
      expect(result).toBe(true);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { email },
        select: { id: true },
      });
    });
  });
});
