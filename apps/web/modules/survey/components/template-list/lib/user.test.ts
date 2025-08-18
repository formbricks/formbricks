import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";
import { updateUser } from "./user";

vi.mock("@/lib/fileValidation", () => ({
  isValidImageFile: vi.fn(),
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

    expect(result).toEqual(mockUser);
  });

  test("throws ResourceNotFoundError when user does not exist", async () => {
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
    const otherError = new Error("Some other error");
    vi.mocked(prisma.user.update).mockRejectedValue(otherError);

    await expect(updateUser("user-123", { name: "New Name" })).rejects.toThrow("Some other error");
  });
});
