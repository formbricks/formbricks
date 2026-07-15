import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { getCredentialPasswordHash, getUserAuthenticationData, verifyUserPassword } from "./password";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  verifyPassword: vi.fn(),
}));

const mockPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockPrismaAccountFindUnique = vi.mocked(prisma.account.findUnique);
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

  test("getCredentialPasswordHash reads the credential Account scoped to the user", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue({ password: "hashed-password" } as any);

    await expect(getCredentialPasswordHash("user-1")).resolves.toBe("hashed-password");

    expect(mockPrismaAccountFindUnique).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: { provider: "credential", providerAccountId: "user-1" },
      },
      select: { password: true },
    });
  });

  test("getCredentialPasswordHash returns null when there is no credential Account", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue(null);

    await expect(getCredentialPasswordHash("sso-user")).resolves.toBeNull();
  });

  test("getCredentialPasswordHash returns null when the credential Account has no password", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue({ password: null } as any);

    await expect(getCredentialPasswordHash("user-without-hash")).resolves.toBeNull();
  });

  test("verifies a password against the credential Account hash", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue({ password: "hashed-password" } as any);
    mockVerifyPassword.mockResolvedValue(true);

    await expect(verifyUserPassword("password-user", "plain-password")).resolves.toBe(true);

    expect(mockVerifyPassword).toHaveBeenCalledWith("plain-password", "hashed-password");
  });

  test("returns false when the password does not match the credential Account hash", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue({ password: "hashed-password" } as any);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(verifyUserPassword("password-user", "wrong-password")).resolves.toBe(false);

    expect(mockVerifyPassword).toHaveBeenCalledWith("wrong-password", "hashed-password");
  });

  test("fails closed when the user has no credential Account (no password to verify)", async () => {
    mockPrismaAccountFindUnique.mockResolvedValue(null);

    await expect(verifyUserPassword("sso-user", "plain-password")).rejects.toThrow(InvalidInputError);

    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });
});
