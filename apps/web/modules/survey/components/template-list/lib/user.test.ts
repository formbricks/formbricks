import { isValidImageFile } from "@/lib/fileValidation";
import { userCache } from "@/lib/user/cache";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";
import { updateUser } from "./user";

vi.mock("@/lib/fileValidation", () => ({
  isValidImageFile: vi.fn(),
}));

vi.mock("@/lib/user/cache", () => ({
  userCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

describe("updateUser", () => {
  const mockUser = {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    imageUrl: "https://example.com/image.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: "project_manager",
    twoFactorEnabled: false,
    identityProvider: "email",
    objective: null,
    locale: "en-US",
    lastLoginAt: new Date(),
    isActive: true,
  } as unknown as TUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully updates a user", async () => {
    vi.mocked(isValidImageFile).mockReturnValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const updateData = { name: "Updated Name" };
    const result = await updateUser("user-123", updateData);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        twoFactorEnabled: true,
        identityProvider: true,
        objective: true,
        notificationSettings: true,
        locale: true,
        lastLoginAt: true,
        isActive: true,
      },
    });
    expect(userCache.revalidate).toHaveBeenCalledWith({
      email: mockUser.email,
      id: mockUser.id,
    });
    expect(result).toEqual(mockUser);
  });

  test("throws InvalidInputError when image file is invalid", async () => {
    vi.mocked(isValidImageFile).mockReturnValue(false);

    const updateData = { imageUrl: "invalid-image.xyz" };
    await expect(updateUser("user-123", updateData)).rejects.toThrow(InvalidInputError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("throws ResourceNotFoundError when user does not exist", async () => {
    vi.mocked(isValidImageFile).mockReturnValue(true);

    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: PrismaErrorType.RecordDoesNotExist,
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.user.update).mockRejectedValue(prismaError);

    await expect(updateUser("non-existent-id", { name: "New Name" })).rejects.toThrow(
      new ResourceNotFoundError("User", "non-existent-id")
    );
  });

  test("re-throws other errors", async () => {
    vi.mocked(isValidImageFile).mockReturnValue(true);

    const otherError = new Error("Some other error");
    vi.mocked(prisma.user.update).mockRejectedValue(otherError);

    await expect(updateUser("user-123", { name: "New Name" })).rejects.toThrow("Some other error");
  });
});
