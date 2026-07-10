import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { IdentityProvider, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TUserLocale, TUserUpdateInput } from "@formbricks/types/user";
import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { publicUserSelect } from "./public-user";
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
    invite: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
  deleteOrganization: vi.fn(),
}));

describe("User Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Shaped as the `publicUserSelect` payload the service actually returns (no sensitive
  // columns). Asserted to the full Prisma `User` row so the select-unaware vitest mocks accept
  // it, while keeping the sensitive keys absent so the `not.toHaveProperty` checks below hold.
  const mockPrismaUser = {
    id: "user1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    twoFactorEnabled: false,
    identityProvider: IdentityProvider.email,
    notificationSettings: {
      alert: {},

      unsubscribedOrganizationIds: [],
    },
    locale: "en-US" as TUserLocale,
    lastLoginAt: new Date(),
    isActive: true,
  } as Prisma.UserGetPayload<object>;

  const mockOrganizations: TOrganization[] = [
    {
      id: "org1",
      name: "Organization 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        limits: {
          workspaces: 3,
          monthly: {
            responses: 1500,
          },
        },
        usageCycleAnchor: new Date(),
      },
      isAISmartToolsEnabled: false,
    },
    {
      id: "org2",
      name: "Organization 2",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        limits: {
          workspaces: 3,
          monthly: {
            responses: 1500,
          },
        },
        usageCycleAnchor: new Date(),
      },
      isAISmartToolsEnabled: false,
    },
  ];

  describe("getUser", () => {
    test("should return user when found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser);

      const result = await getUser("user1");

      expect(result).toEqual(mockPrismaUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user1" },
        select: publicUserSelect,
      });
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("twoFactorSecret");
      expect(result).not.toHaveProperty("backupCodes");
      expect(result).not.toHaveProperty("identityProviderAccountId");
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
        select: publicUserSelect,
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
        select: publicUserSelect,
      });
    });

    test("should throw ResourceNotFoundError when user not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: PrismaErrorType.RelatedRecordNotFound,
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.user.update).mockRejectedValue(prismaError);

      await expect(updateUser("nonexistent", { name: "New Name" })).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("deleteUser", () => {
    test("should delete user and their organizations when they are single owner", async () => {
      vi.mocked(prisma.user.delete).mockResolvedValue(mockPrismaUser);
      vi.mocked(prisma.invite.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue(mockOrganizations);
      vi.mocked(deleteOrganization).mockResolvedValue();

      const result = await deleteUser("user1");

      expect(result).toEqual(mockPrismaUser);
      expect(getOrganizationsWhereUserIsSingleOwner).toHaveBeenCalledWith("user1");
      expect(deleteOrganization).toHaveBeenCalledWith("org1");
      expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user1" } });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user1" },
        select: publicUserSelect,
      });
    });

    // Regression for ENG-1057: Invite.creatorId has no onDelete rule, so any
    // pending invite created by the user must be cleared before user.delete
    // or Postgres rejects with a foreign-key constraint violation.
    test("should delete pending invites where the user is creator before deleting the user", async () => {
      vi.mocked(prisma.user.delete).mockResolvedValue(mockPrismaUser);
      vi.mocked(prisma.invite.deleteMany).mockResolvedValue({ count: 3 });
      vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([]);

      await deleteUser("user1");

      expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user1" } });
      const inviteDeleteOrder = vi.mocked(prisma.invite.deleteMany).mock.invocationCallOrder[0];
      const userDeleteOrder = vi.mocked(prisma.user.delete).mock.invocationCallOrder[0];
      expect(inviteDeleteOrder).toBeLessThan(userDeleteOrder);
    });

    test("should throw DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([]);
      vi.mocked(prisma.invite.deleteMany).mockResolvedValue({ count: 0 });
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
        select: publicUserSelect,
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
