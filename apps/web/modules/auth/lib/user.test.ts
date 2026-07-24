import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
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
    $transaction: vi.fn(),
    user: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("User Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        $queryRaw: vi.fn(),
        user: {
          update: vi.mocked(prisma.user.update),
        },
      } as any)
    );
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
    });

    test("creates a user with an Azure AD enterprise display name", async () => {
      const enterpriseDisplayName = "Lastname,Firstname (DEPT) COMPANY-CITY";
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        ...mockPrismaUser,
        name: enterpriseDisplayName,
      });

      const result = await createUser({
        email: mockUser.email,
        name: enterpriseDisplayName,
        locale: mockUser.locale,
      });

      expect(result.name).toBe(enterpriseDisplayName);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: enterpriseDisplayName,
          }),
        })
      );
    });

    test("rejects display names with newline characters", async () => {
      await expect(
        createUser({
          email: mockUser.email,
          name: "Lastname,Firstname\n(DEPT) COMPANY-CITY",
          locale: mockUser.locale,
        })
      ).rejects.toThrow(ValidationError);

      expect(prisma.user.create).not.toHaveBeenCalled();
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

    test("throws DatabaseError on a non-unique Prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.create).mockRejectedValueOnce(errToThrow);

      await expect(
        createUser({
          email: mockUser.email,
          name: mockUser.name,
          locale: mockUser.locale,
        })
      ).rejects.toMatchObject({ name: "DatabaseError" });
    });

    test("rethrows non-Prisma errors", async () => {
      vi.mocked(prisma.user.create).mockRejectedValueOnce(new Error("boom"));

      await expect(
        createUser({
          email: mockUser.email,
          name: mockUser.name,
          locale: mockUser.locale,
        })
      ).rejects.toThrow("boom");
    });
  });

  describe("updateUser", () => {
    const mockUpdateData = { name: "Updated Name" };

    test("updates a user successfully", async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockPrismaUser, name: mockUpdateData.name });

      const result = await updateUser(mockUser.id, mockUpdateData);

      expect(result).toEqual({ ...mockPrismaUser, name: mockUpdateData.name });
    });

    test("throws ResourceNotFoundError when user doesn't exist", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: PrismaErrorType.RecordNotFound,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.update).mockRejectedValueOnce(errToThrow);

      await expect(updateUser(mockUser.id, mockUpdateData)).rejects.toThrow(ResourceNotFoundError);
    });

    test("rethrows non-Prisma errors", async () => {
      vi.mocked(prisma.user.update).mockRejectedValueOnce(new Error("boom"));

      await expect(updateUser(mockUser.id, mockUpdateData)).rejects.toThrow("boom");
    });
  });

  describe("updateUserLastLoginAt", () => {
    test("updates a user successfully and returns the previous login timestamp", async () => {
      const previousLastLoginAt = new Date("2025-04-16T10:00:00.000Z");
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
        callback({
          $queryRaw: vi.fn().mockResolvedValue([{ id: mockUser.id, lastLoginAt: previousLastLoginAt }]),
          user: {
            update: vi.fn().mockResolvedValue({ ...mockPrismaUser, lastLoginAt: new Date() }),
          },
        } as any)
      );

      const result = await updateUserLastLoginAt(mockUser.email);

      expect(result).toEqual(previousLastLoginAt);
    });

    test("locks with FOR NO KEY UPDATE, not FOR UPDATE (sign-in FK deadlock, ENG-2038)", async () => {
      const queryRaw = vi.fn().mockResolvedValue([{ id: mockUser.id, lastLoginAt: null }]);
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
        callback({
          $queryRaw: queryRaw,
          user: {
            update: vi.fn().mockResolvedValue({ ...mockPrismaUser, lastLoginAt: new Date() }),
          },
        } as any)
      );

      await updateUserLastLoginAt(mockUser.email);

      // $queryRaw is a tagged template: the first call arg is the array of string literals.
      const sql = (queryRaw.mock.calls[0][0] as string[]).join(" ").replace(/\s+/g, " ");
      expect(sql).toContain("FOR NO KEY UPDATE");
      // FOR UPDATE conflicts with the FK FOR KEY SHARE lock — a revert must fail this test.
      expect(sql).not.toContain("FOR UPDATE");
    });

    test("throws ResourceNotFoundError when user doesn't exist", async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
        callback({
          $queryRaw: vi.fn().mockResolvedValue([]),
          user: {
            update: vi.fn(),
          },
        } as any)
      );

      await expect(updateUserLastLoginAt(mockUser.email)).rejects.toThrow(ResourceNotFoundError);
    });

    test("throws ResourceNotFoundError on a RecordNotFound Prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: PrismaErrorType.RecordNotFound,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(errToThrow);

      await expect(updateUserLastLoginAt(mockUser.email)).rejects.toThrow(ResourceNotFoundError);
    });

    test("rethrows non-Prisma errors", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("boom"));

      await expect(updateUserLastLoginAt(mockUser.email)).rejects.toThrow("boom");
    });
  });

  describe("getUserByEmail", () => {
    const mockEmail = "test@example.com";

    test("retrieves a user by email successfully", async () => {
      const mockUser = {
        id: "user123",
        email: mockEmail,
        locale: "en",
        emailVerified: false,
      };
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(
        mockUser as Awaited<ReturnType<typeof prisma.user.findFirst>>
      );

      const result = await getUserByEmail(mockEmail);

      expect(result).toEqual(mockUser);
    });

    test("throws DatabaseError on prisma error", async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error("Database error"));

      await expect(getUserByEmail(mockEmail)).rejects.toThrow();
    });

    test("throws DatabaseError on a known Prisma request error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(errToThrow);

      await expect(getUserByEmail(mockEmail)).rejects.toMatchObject({ name: "DatabaseError" });
    });
  });

  describe("getUser", () => {
    const mockUserId = "cm5xj580r00000cmgdj9ohups";

    test("retrieves a user by id successfully", async () => {
      const mockUser = {
        id: mockUserId,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        mockUser as Awaited<ReturnType<typeof prisma.user.findUnique>>
      );

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

    test("throws DatabaseError on a known Prisma request error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2010",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(errToThrow);

      await expect(getUser(mockUserId)).rejects.toMatchObject({ name: "DatabaseError" });
    });
  });
});
