import { verifyPassword as mockVerifyPasswordImported } from "@/modules/auth/lib/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkUserExistsByEmail, verifyUserPassword } from "./user";

// Mock dependencies
vi.mock("@/lib/user/cache", () => ({
  userCache: {
    tag: {
      byId: vi.fn((id) => `user-${id}-tag`),
      byEmail: vi.fn((email) => `user-email-${email}-tag`),
    },
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// reactCache (from "react") and unstable_cache (from "next/cache") are mocked in vitestSetup.ts
// to be pass-through, so the inner logic of cached functions is tested.

const mockPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockVerifyPasswordUtil = vi.mocked(mockVerifyPasswordImported);

describe("User Library Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("verifyUserPassword", () => {
    const userId = "test-user-id";
    const password = "test-password";

    test("should return true for correct password", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        password: "hashed-password",
        identityProvider: "email",
      } as any);
      mockVerifyPasswordUtil.mockResolvedValue(true);

      const result = await verifyUserPassword(userId, password);
      expect(result).toBe(true);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true, identityProvider: true },
      });
      expect(mockVerifyPasswordUtil).toHaveBeenCalledWith(password, "hashed-password");
    });

    test("should return false for incorrect password", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        password: "hashed-password",
        identityProvider: "email",
      } as any);
      mockVerifyPasswordUtil.mockResolvedValue(false);

      const result = await verifyUserPassword(userId, password);
      expect(result).toBe(false);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true, identityProvider: true },
      });
      expect(mockVerifyPasswordUtil).toHaveBeenCalledWith(password, "hashed-password");
    });

    test("should throw ResourceNotFoundError if user not found", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);

      await expect(verifyUserPassword(userId, password)).rejects.toThrow(ResourceNotFoundError);
      await expect(verifyUserPassword(userId, password)).rejects.toThrow(`user with ID ${userId} not found`);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true, identityProvider: true },
      });
      expect(mockVerifyPasswordUtil).not.toHaveBeenCalled();
    });

    test("should throw InvalidInputError if identityProvider is not email", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        password: "hashed-password",
        identityProvider: "google", // Not 'email'
      } as any);

      await expect(verifyUserPassword(userId, password)).rejects.toThrow(InvalidInputError);
      await expect(verifyUserPassword(userId, password)).rejects.toThrow(
        "Third party login is already enabled"
      );
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true, identityProvider: true },
      });
      expect(mockVerifyPasswordUtil).not.toHaveBeenCalled();
    });

    test("should throw InvalidInputError if password is not set for email provider", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        password: null, // Password not set
        identityProvider: "email",
      } as any);

      await expect(verifyUserPassword(userId, password)).rejects.toThrow(InvalidInputError);
      await expect(verifyUserPassword(userId, password)).rejects.toThrow(
        "Third party login is already enabled"
      );
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true, identityProvider: true },
      });
      expect(mockVerifyPasswordUtil).not.toHaveBeenCalled();
    });
  });

  describe("checkUserExistsByEmail", () => {
    const email = "test@example.com";

    test("should return true if user exists", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        id: "some-user-id",
      } as any);

      const result = await checkUserExistsByEmail(email);
      expect(result).toBe(true);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { email },
        select: { id: true },
      });
    });

    test("should return false if user does not exist", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const result = await checkUserExistsByEmail(email);
      expect(result).toBe(false);
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { email },
        select: { id: true },
      });
    });
  });
});
