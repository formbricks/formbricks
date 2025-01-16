import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { createCustomerIoCustomer } from "@formbricks/lib/customerio";
import { userCache } from "@formbricks/lib/user/cache";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { createUser, getUser, getUserByEmail, updateUser } from "./user";

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

vi.mock("@formbricks/lib/customerio", () => ({
  createCustomerIoCustomer: vi.fn(),
}));

vi.mock("@formbricks/lib/user/cache", () => ({
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
    const mockUserData = {
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    };

    it("creates a user successfully", async () => {
      const mockCreatedUser = { ...mockUserData, id: "cm5xic7rn00010clbg6eucw1p", notificationSettings: {} };
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockCreatedUser);

      const result = await createUser(mockUserData);

      expect(result).toEqual(mockCreatedUser);
      expect(createCustomerIoCustomer).toHaveBeenCalledWith({
        id: mockCreatedUser.id,
        email: mockCreatedUser.email,
      });
      expect(userCache.revalidate).toHaveBeenCalled();
    });

    it("throws InvalidInputError when email already exists", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.create).mockRejectedValueOnce(errToThrow);

      await expect(createUser(mockUserData)).rejects.toThrow(InvalidInputError);
    });
  });

  describe("updateUser", () => {
    const mockUserId = "user123";
    const mockUpdateData = { name: "Updated Name" };

    it("updates a user successfully", async () => {
      const mockUpdatedUser = {
        id: mockUserId,
        email: "test@example.com",
        locale: "en",
        emailVerified: null,
      };
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUpdatedUser);

      const result = await updateUser(mockUserId, mockUpdateData);

      expect(result).toEqual(mockUpdatedUser);
      expect(userCache.revalidate).toHaveBeenCalled();
    });

    it("throws ResourceNotFoundError when user doesn't exist", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
        code: "P2016",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.user.update).mockRejectedValueOnce(errToThrow);

      await expect(updateUser(mockUserId, mockUpdateData)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("getUserByEmail", () => {
    const mockEmail = "test@example.com";

    it("retrieves a user by email successfully", async () => {
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

    it("throws DatabaseError on prisma error", async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error("Database error"));

      await expect(getUserByEmail(mockEmail)).rejects.toThrow();
    });
  });

  describe("getUser", () => {
    const mockUserId = "cm5xj580r00000cmgdj9ohups";

    it("retrieves a user by id successfully", async () => {
      const mockUser = {
        id: mockUserId,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

      const result = await getUser(mockUserId);

      expect(result).toEqual(mockUser);
    });

    it("returns null when user doesn't exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await getUser(mockUserId);

      expect(result).toBeNull();
    });

    it("throws DatabaseError on prisma error", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error("Database error"));

      await expect(getUser(mockUserId)).rejects.toThrow();
    });
  });
});
