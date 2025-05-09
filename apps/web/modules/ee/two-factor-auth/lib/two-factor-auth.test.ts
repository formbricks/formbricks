import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { userCache } from "@/lib/user/cache";
import { totpAuthenticatorCheck } from "@/modules/auth/lib/totp";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "./two-factor-auth";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/modules/auth/lib/totp", () => ({
  totpAuthenticatorCheck: vi.fn(),
}));

vi.mock("@/lib/user/cache", () => ({
  userCache: {
    revalidate: vi.fn(),
  },
}));

describe("Two Factor Auth", () => {
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

  test("setupTwoFactorAuth should throw InvalidInputError when user has no password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: null,
      identityProvider: "email",
    } as any);

    await expect(setupTwoFactorAuth("user123", "password123")).rejects.toThrow(
      new InvalidInputError("User does not have a password set")
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
    vi.mocked(verifyPassword).mockResolvedValue(false);

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
    vi.mocked(verifyPassword).mockResolvedValue(true);
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
      password: null,
      identityProvider: "email",
    } as any);

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
    expect(userCache.revalidate).toHaveBeenCalledWith({ id: "user123" });
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

  test("disableTwoFactorAuth should throw InvalidInputError when user has no password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: null,
      identityProvider: "email",
    } as any);

    await expect(disableTwoFactorAuth("user123", { password: "password123" })).rejects.toThrow(
      new InvalidInputError("User does not have a password set")
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
    vi.mocked(verifyPassword).mockResolvedValue(false);

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
    vi.mocked(verifyPassword).mockResolvedValue(true);
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
    vi.mocked(verifyPassword).mockResolvedValue(true);
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
    vi.mocked(verifyPassword).mockResolvedValue(true);
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
    expect(userCache.revalidate).toHaveBeenCalledWith({ id: "user123" });
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
    vi.mocked(verifyPassword).mockResolvedValue(true);
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
    expect(userCache.revalidate).toHaveBeenCalledWith({ id: "user123" });
  });
});
