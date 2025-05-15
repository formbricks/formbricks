import { userCache } from "@/lib/user/cache";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { mockUser } from "./mock-data";
import { createUser, getUser, getUserByEmail, updateUser, updateUserLastLoginAt } from "./user";

const mockPrismaUser = {
  ...mockUser,
  password: "password",
  identityProviderAccountId: "identityProviderAccountId",
  twoFactorSecret: "twoFactorSecret",
  backupCodes: "backupCodes",
  groupId: "groupId",
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user/cache", () => ({
  userCache: {
    revalidate: vi.fn(),
    tag: {
      byEmail: vi.fn(),
      byId: vi.fn(),
    },
  },
}));

describe("User Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    test("creates a user successfully", async () => {
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockPrismaUser);

      const result = await createUser({
        email: mockUser.email,
        name: mockUser.name,
        locale: mockUser.locale,
      });

      expect(result).toEqual(mockPrismaUser);
      expect(userCache.revalidate).toHaveBeenCalled();
    });

    test("throws InvalidInputError when email already exists", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.create).mockRejectedValueOnce(errToThrow);

      await expect(
        createUser({
          email: mockUser.email,
          name: mockUser.name,
          locale: mockUser.locale,
        })
      ).rejects.toThrow(InvalidInputError);
    });
  });

  describe("updateUser", () => {
    const mockUpdateData = { name: "Updated Name" };

    test("updates a user successfully", async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockPrismaUser, name: mockUpdateData.name });

      const result = await updateUser(mockUser.id, mockUpdateData);

      expect(result).toEqual({ ...mockPrismaUser, name: mockUpdateData.name });
      expect(userCache.revalidate).toHaveBeenCalled();
    });

    test("throws ResourceNotFoundError when user doesn't exist", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.update).mockRejectedValueOnce(errToThrow);

      await expect(updateUser(mockUser.id, mockUpdateData)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("updateUserLastLoginAt", () => {
    const mockUpdateData = { name: "Updated Name" };

    test("updates a user successfully", async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockPrismaUser, name: mockUpdateData.name });

      const result = await updateUserLastLoginAt(mockUser.email);

      expect(result).toEqual(void 0);
      expect(userCache.revalidate).toHaveBeenCalled();
    });

    test("throws ResourceNotFoundError when user doesn't exist", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.update).mockRejectedValueOnce(errToThrow);

      await expect(updateUserLastLoginAt(mockUser.email)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("getUserByEmail", () => {
    const mockEmail = "test@example.com";

    test("retrieves a user by email successfully", async () => {
      const mockUser = {
        id: "user123",
        email: mockEmail,
        locale: "en",
        emailVerified: null,
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockUser);

      const result = await getUserByEmail(mockEmail);

      expect(result).toEqual(mockUser);
    });

    test("throws DatabaseError on prisma error", async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error("Database error"));

      await expect(getUserByEmail(mockEmail)).rejects.toThrow();
    });
  });

  describe("getUser", () => {
    const mockUserId = "cm5xj580r00000cmgdj9ohups";

    test("retrieves a user by id successfully", async () => {
      const mockUser = {
        id: mockUserId,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

      const result = await getUser(mockUserId);

      expect(result).toEqual(mockUser);
    });

    test("returns null when user doesn't exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await getUser(mockUserId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError on prisma error", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error("Database error"));

      await expect(getUser(mockUserId)).rejects.toThrow();
    });
  });
});
