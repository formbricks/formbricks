import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/types/errors";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { getCredentialPasswordHash, hasCredentialAccount, verifyUserPassword } from "./password";

vi.mock("@formbricks/database", () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  verifyPassword: vi.fn(),
}));

const mockPrismaAccountFindUnique = vi.mocked(prisma.account.findUnique);
const mockVerifyPassword = vi.mocked(verifyPassword);

describe("user password helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  test("hasCredentialAccount uses Better Auth's own credential-account predicate", async () => {
    vi.mocked(prisma.account.count).mockResolvedValue(1);

    await expect(hasCredentialAccount("user-1")).resolves.toBe(true);
    // The same four-column predicate Better Auth's `findCredentialAccount` uses. Anything broader would
    // answer "may reset" for a row `resetPassword` cannot then find, which turns into a unique-constraint
    // collision on its create branch rather than a reset.
    expect(prisma.account.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        provider: "credential",
        providerAccountId: "user-1",
      },
    });
  });

  test("hasCredentialAccount is false for an SSO-only user", async () => {
    vi.mocked(prisma.account.count).mockResolvedValue(0);

    await expect(hasCredentialAccount("user-2")).resolves.toBe(false);
  });
});
