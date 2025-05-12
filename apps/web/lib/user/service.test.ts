import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { IdentityProvider, Objective, Prisma, Role } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TUserLocale, TUserUpdateInput } from "@formbricks/types/user";
import { deleteUser, getUser, getUserByEmail, getUsersWithOrganization, updateUser } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/fileValidation", () => ({
  isValidImageFile: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
  deleteOrganization: vi.fn(),
}));

describe("User Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockPrismaUser = {
    id: "user1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: new Date(),
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: Role.project_manager,
    twoFactorEnabled: false,
    identityProvider: IdentityProvider.email,
    objective: Objective.increase_conversion,
    notificationSettings: {
      alert: {},
      weeklySummary: {},
      unsubscribedOrganizationIds: [],
    },
    locale: "en-US" as TUserLocale,
    lastLoginAt: new Date(),
    isActive: true,
    twoFactorSecret: null,
    backupCodes: null,
    password: null,
    identityProviderAccountId: null,
    groupId: null,
  };

  const mockOrganizations: TOrganization[] = [
    {
      id: "org1",
      name: "Organization 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
            miu: 2000,
          },
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    },
    {
      id: "org2",
      name: "Organization 2",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
            miu: 2000,
          },
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    },
  ];

  describe("getUser", () => {
    test("should return user when found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser);

      const result = await getUser("user1");

      expect(result).toEqual(mockPrismaUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user1" },
        select: expect.any(Object),
      });
    });

    test("should return null when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getUser("nonexistent");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.user.findUnique).mockRejectedValue(prismaError);

      await expect(getUser("user1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getUserByEmail", () => {
    test("should return user when found by email", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockPrismaUser);

      const result = await getUserByEmail("test@example.com");

      expect(result).toEqual(mockPrismaUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        select: expect.any(Object),
      });
    });

    test("should return null when user not found by email", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await getUserByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.user.findFirst).mockRejectedValue(prismaError);

      await expect(getUserByEmail("test@example.com")).rejects.toThrow(DatabaseError);
    });
  });

  describe("updateUser", () => {
    test("should update user successfully", async () => {
      const updatedPrismaUser = {
        ...mockPrismaUser,
        name: "Updated User",
      };

      const updateData: TUserUpdateInput = {
        name: "Updated User",
      };

      vi.mocked(prisma.user.update).mockResolvedValue(updatedPrismaUser);

      const result = await updateUser("user1", updateData);

      expect(result).toEqual(updatedPrismaUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: updateData,
        select: expect.any(Object),
      });
    });

    test("should throw ResourceNotFoundError when user not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.user.update).mockRejectedValue(prismaError);

      await expect(updateUser("nonexistent", { name: "New Name" })).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw InvalidInputError when invalid image URL is provided", async () => {
      const { isValidImageFile } = await import("@/lib/fileValidation");
      vi.mocked(isValidImageFile).mockReturnValue(false);

      await expect(updateUser("user1", { imageUrl: "invalid-image-url" })).rejects.toThrow(InvalidInputError);
    });
  });

  describe("deleteUser", () => {
    test("should delete user and their organizations when they are single owner", async () => {
      vi.mocked(prisma.user.delete).mockResolvedValue(mockPrismaUser);
      vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue(mockOrganizations);
      vi.mocked(deleteOrganization).mockResolvedValue();

      const result = await deleteUser("user1");

      expect(result).toEqual(mockPrismaUser);
      expect(getOrganizationsWhereUserIsSingleOwner).toHaveBeenCalledWith("user1");
      expect(deleteOrganization).toHaveBeenCalledWith("org1");
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user1" },
        select: expect.any(Object),
      });
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([]);
      vi.mocked(prisma.user.delete).mockRejectedValue(prismaError);

      await expect(deleteUser("user1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getUsersWithOrganization", () => {
    test("should return users in an organization", async () => {
      const mockUsers = [mockPrismaUser];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const result = await getUsersWithOrganization("org1");

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          memberships: {
            some: {
              organizationId: "org1",
            },
          },
        },
        select: expect.any(Object),
      });
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.user.findMany).mockRejectedValue(prismaError);

      await expect(getUsersWithOrganization("org1")).rejects.toThrow(DatabaseError);
    });
  });
});
