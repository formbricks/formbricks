import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { getCredentialPasswordHash, verifyUserPassword } from "@/lib/user/password";
import { buildReencodedTwoFactorData } from "@/modules/auth/lib/cutover/reencode-two-factor";
import { totpAuthenticatorCheck } from "@/modules/auth/lib/totp";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "./two-factor-auth";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    twoFactor: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Runs the passed prisma operations; the individual mocks above record their own calls.
    $transaction: vi.fn((ops) => Promise.resolve(ops)),
  },
}));

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock("@/lib/user/password", () => ({
  getCredentialPasswordHash: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { $context: Promise.resolve({ secretConfig: "ba-secret-config" }) },
}));

vi.mock("@/modules/auth/lib/cutover/reencode-two-factor", () => ({
  buildReencodedTwoFactorData: vi.fn(),
}));

vi.mock("@/modules/auth/lib/totp", () => ({
  totpAuthenticatorCheck: vi.fn(),
}));

describe("Two Factor Auth", () => {
  beforeEach(() => {
    // Happy-path defaults: enable checks credential presence (getCredentialPasswordHash); setup and
    // disable delegate password verification to verifyUserPassword. "No password" / "incorrect
    // password" tests override these.
    vi.mocked(getCredentialPasswordHash).mockResolvedValue("hashedPassword");
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(buildReencodedTwoFactorData).mockResolvedValue({
      secret: "ba-secret",
      backupCodes: "ba-codes",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("setupTwoFactorAuth should throw ResourceNotFoundError when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(setupTwoFactorAuth("user123", "password123")).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user123" },
    });
  });

  test("setupTwoFactorAuth should reject when the user has no password (via verifyUserPassword)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      identityProvider: "email",
    } as any);
    vi.mocked(verifyUserPassword).mockRejectedValue(
      new InvalidInputError("Password is not set for this user")
    );

    await expect(setupTwoFactorAuth("user123", "password123")).rejects.toThrow(
      new InvalidInputError("Password is not set for this user")
    );
  });

  test("setupTwoFactorAuth should throw InvalidInputError when user has third party login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "google",
    } as any);

    await expect(setupTwoFactorAuth("user123", "password123")).rejects.toThrow(
      new InvalidInputError("Third party login is already enabled")
    );
  });

  test("setupTwoFactorAuth should throw InvalidInputError when password is incorrect", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
    } as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(false);

    await expect(setupTwoFactorAuth("user123", "wrongPassword")).rejects.toThrow(
      new InvalidInputError("Incorrect password")
    );
  });

  test("setupTwoFactorAuth should successfully setup 2FA", async () => {
    const mockUser = {
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      email: "test@example.com",
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(symmetricEncrypt).mockImplementation((data) => `encrypted_${data}`);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const result = await setupTwoFactorAuth("user123", "correctPassword");

    expect(result).toHaveProperty("secret");
    expect(result).toHaveProperty("keyUri");
    expect(result).toHaveProperty("dataUri");
    expect(result).toHaveProperty("backupCodes");
    expect(result.backupCodes).toHaveLength(10);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  test("enableTwoFactorAuth should throw ResourceNotFoundError when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user123" },
    });
  });

  test("enableTwoFactorAuth should throw InvalidInputError when user has no password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      identityProvider: "email",
    } as any);
    vi.mocked(getCredentialPasswordHash).mockResolvedValue(null);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("User does not have a password set")
    );
  });

  test("enableTwoFactorAuth should throw InvalidInputError when user has third party login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "google",
    } as any);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("Third party login is already enabled")
    );
  });

  test("enableTwoFactorAuth should throw InvalidInputError when 2FA is already enabled", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
    } as any);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("Two factor authentication is already enabled")
    );
  });

  test("enableTwoFactorAuth should throw InvalidInputError when 2FA setup is not completed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: false,
      twoFactorSecret: null,
    } as any);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("Two factor setup has not been completed")
    );
  });

  test("enableTwoFactorAuth should throw InvalidInputError when secret is invalid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: false,
      twoFactorSecret: "encrypted_secret",
    } as any);
    vi.mocked(symmetricDecrypt).mockReturnValue("invalid_secret");

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("Invalid secret")
    );
  });

  test("enableTwoFactorAuth should throw InvalidInputError when code is invalid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: false,
      twoFactorSecret: "encrypted_secret",
    } as any);
    vi.mocked(symmetricDecrypt).mockReturnValue("12345678901234567890123456789012");
    vi.mocked(totpAuthenticatorCheck).mockReturnValue(false);

    await expect(enableTwoFactorAuth("user123", "123456")).rejects.toThrow(
      new InvalidInputError("Invalid code")
    );
  });

  test("enableTwoFactorAuth should successfully enable 2FA", async () => {
    const mockUser = {
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: false,
      twoFactorSecret: "encrypted_secret",
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(symmetricDecrypt).mockReturnValue("12345678901234567890123456789012");
    vi.mocked(totpAuthenticatorCheck).mockReturnValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const result = await enableTwoFactorAuth("user123", "123456");

    expect(result).toEqual({ message: "Two factor authentication enabled" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user123" },
      data: { twoFactorEnabled: true },
    });
    // ENG-1824: also materialize the Better Auth TwoFactor row (which login verifies against).
    expect(buildReencodedTwoFactorData).toHaveBeenCalledWith(
      "encrypted_secret",
      undefined,
      "ba-secret-config"
    );
    expect(prisma.twoFactor.upsert).toHaveBeenCalledWith({
      where: { userId: "user123" },
      update: { secret: "ba-secret", backupCodes: "ba-codes", verified: true },
      create: { userId: "user123", secret: "ba-secret", backupCodes: "ba-codes", verified: true },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  test("disableTwoFactorAuth should throw ResourceNotFoundError when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(disableTwoFactorAuth("user123", { password: "password123" })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user123" },
    });
  });

  test("disableTwoFactorAuth should reject when the user has no password (via verifyUserPassword)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      identityProvider: "email",
      twoFactorEnabled: true,
    } as any);
    vi.mocked(verifyUserPassword).mockRejectedValue(
      new InvalidInputError("Password is not set for this user")
    );

    await expect(disableTwoFactorAuth("user123", { password: "password123" })).rejects.toThrow(
      new InvalidInputError("Password is not set for this user")
    );
  });

  test("disableTwoFactorAuth should throw InvalidInputError when user has third party login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "google",
      twoFactorEnabled: true,
    } as any);

    await expect(disableTwoFactorAuth("user123", { password: "password123" })).rejects.toThrow(
      new InvalidInputError("Third party login is already enabled")
    );
  });

  test("disableTwoFactorAuth should throw InvalidInputError when 2FA is not enabled", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: false,
    } as any);

    await expect(disableTwoFactorAuth("user123", { password: "password123" })).rejects.toThrow(
      new InvalidInputError("Two factor authentication is not enabled")
    );
  });

  test("disableTwoFactorAuth should throw InvalidInputError when password is incorrect", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
    } as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(false);

    await expect(disableTwoFactorAuth("user123", { password: "wrongPassword" })).rejects.toThrow(
      new InvalidInputError("Incorrect password")
    );
  });

  test("disableTwoFactorAuth should throw InvalidInputError when backup code is invalid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
      backupCodes: "encrypted_backup_codes",
    } as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(symmetricDecrypt).mockReturnValue(JSON.stringify(["code1", "code2"]));

    await expect(
      disableTwoFactorAuth("user123", { password: "password123", backupCode: "invalid-code" })
    ).rejects.toThrow(new InvalidInputError("Incorrect backup code"));
  });

  test("disableTwoFactorAuth should throw InvalidInputError when 2FA code is invalid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
    } as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(symmetricDecrypt).mockReturnValue("12345678901234567890123456789012");
    vi.mocked(totpAuthenticatorCheck).mockReturnValue(false);

    await expect(
      disableTwoFactorAuth("user123", { password: "password123", code: "123456" })
    ).rejects.toThrow(new InvalidInputError("Invalid code"));
  });

  test("disableTwoFactorAuth should successfully disable 2FA with backup code", async () => {
    const mockUser = {
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
      backupCodes: "encrypted_backup_codes",
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(symmetricDecrypt).mockReturnValue(JSON.stringify(["validcode", "code2"]));
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const result = await disableTwoFactorAuth("user123", {
      password: "password123",
      backupCode: "valid-code",
    });

    expect(result).toEqual({ message: "Two factor authentication disabled" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user123" },
      data: {
        backupCodes: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    // ENG-1824: also remove the Better Auth TwoFactor row so 2FA is fully off.
    expect(prisma.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: "user123" } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  test("disableTwoFactorAuth should successfully disable 2FA with 2FA code", async () => {
    const mockUser = {
      id: "user123",
      password: "hashedPassword",
      identityProvider: "email",
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(symmetricDecrypt).mockReturnValue("12345678901234567890123456789012");
    vi.mocked(totpAuthenticatorCheck).mockReturnValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const result = await disableTwoFactorAuth("user123", { password: "password123", code: "123456" });

    expect(result).toEqual({ message: "Two factor authentication disabled" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user123" },
      data: {
        backupCodes: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    // ENG-1824: also remove the Better Auth TwoFactor row so 2FA is fully off.
    expect(prisma.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: "user123" } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
