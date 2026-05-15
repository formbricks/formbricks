import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { getUserAuthenticationData, verifyUserPassword } from "./password";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  verifyPassword: vi.fn(),
}));

const mockPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockVerifyPassword = vi.mocked(verifyPassword);

describe("user password helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns authentication data for an existing user", async () => {
    const user = {
      email: "user@example.com",
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    };
    mockPrismaUserFindUnique.mockResolvedValue(user as any);

    await expect(getUserAuthenticationData("user-with-password")).resolves.toEqual(user);

    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: {
        id: "user-with-password",
      },
      select: {
        email: true,
        password: true,
        identityProvider: true,
        identityProviderAccountId: true,
      },
    });
  });

  test("throws when authentication data is missing", async () => {
    mockPrismaUserFindUnique.mockResolvedValue(null);

    await expect(getUserAuthenticationData("missing-user")).rejects.toThrow(ResourceNotFoundError);
  });

  test("verifies a password against the stored hash", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "password-user@example.com",
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    } as any);
    mockVerifyPassword.mockResolvedValue(true);

    await expect(verifyUserPassword("password-user", "plain-password")).resolves.toBe(true);

    expect(mockVerifyPassword).toHaveBeenCalledWith("plain-password", "hashed-password");
  });

  test("returns false when the password does not match the stored hash", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "password-user@example.com",
      identityProvider: "email",
      identityProviderAccountId: null,
      password: "hashed-password",
    } as any);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(verifyUserPassword("password-user", "wrong-password")).resolves.toBe(false);

    expect(mockVerifyPassword).toHaveBeenCalledWith("wrong-password", "hashed-password");
  });

  test("rejects password verification for users without a password", async () => {
    mockPrismaUserFindUnique.mockResolvedValue({
      email: "sso-user@example.com",
      identityProvider: "google",
      identityProviderAccountId: "google-account-id",
      password: null,
    } as any);

    await expect(verifyUserPassword("sso-user", "plain-password")).rejects.toThrow(InvalidInputError);

    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });
});
