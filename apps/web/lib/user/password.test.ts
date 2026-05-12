import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyPassword as mockVerifyPasswordImported } from "@/modules/auth/lib/utils";
import { getUserAuthenticationData, verifyUserPassword } from "./password";

vi.mock("server-only", () => ({}));

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

const mockPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockVerifyPassword = vi.mocked(mockVerifyPasswordImported);

describe("user password helpers", () => {
  const userId = "test-user-id";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns authentication data for an existing user", async () => {
    const authenticationData = {
      email: "user@example.com",
      password: "hashed-password",
      identityProvider: "email",
      identityProviderAccountId: null,
    };
    mockPrismaUserFindUnique.mockResolvedValue(authenticationData as any);

    await expect(getUserAuthenticationData(userId)).resolves.toEqual(authenticationData);
    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: {
        email: true,
        password: true,
        identityProvider: true,
        identityProviderAccountId: true,
      },
    });
  });

  test("throws when authentication data cannot find the user", async () => {
    mockPrismaUserFindUnique.mockResolvedValue(null);

    await expect(getUserAuthenticationData(userId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("verifies a password against the stored hash", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "user@example.com",
      password: "hashed-password",
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);
    mockVerifyPassword.mockResolvedValue(true);

    await expect(verifyUserPassword(userId, "plain-password")).resolves.toBe(true);
    expect(mockVerifyPassword).toHaveBeenCalledWith("plain-password", "hashed-password");
  });

  test("returns false when the password does not match", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "user@example.com",
      password: "hashed-password",
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(verifyUserPassword(userId, "wrong-password")).resolves.toBe(false);
    expect(mockVerifyPassword).toHaveBeenCalledWith("wrong-password", "hashed-password");
  });

  test("throws when the user does not have a password", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "sso-user@example.com",
      password: null,
      identityProvider: "google",
      identityProviderAccountId: "google-account-id",
    } as any);

    await expect(verifyUserPassword(userId, "plain-password")).rejects.toThrow(InvalidInputError);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });
});
