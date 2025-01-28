import { randomBytes } from "crypto";
import { Provider } from "next-auth/providers/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED } from "@formbricks/lib/constants";
import { createToken } from "@formbricks/lib/jwt";
import { authOptions } from "./authOptions";
import { mockUser } from "./mock-data";
import { hashPassword } from "./utils";

const mockUserId = "cm5yzxcp900000cl78fzocjal";
const mockPassword = randomBytes(12).toString("hex");
const mockHashedPassword = await hashPassword(mockPassword);

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

// Helper to get the provider by id from authOptions.providers.
function getProviderById(id: string): Provider {
  const provider = authOptions.providers.find((p) => p.options.id === id);
  if (!provider) {
    throw new Error(`Provider with id ${id} not found`);
  }
  return provider;
}

describe("authOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CredentialsProvider (credentials) - email/password login", () => {
    const credentialsProvider = getProviderById("credentials");

    it("should throw error if credentials are not provided", async () => {
      await expect(credentialsProvider.options.authorize(undefined, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error if user not found", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error if user has no password stored", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        password: null,
      });

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "User has no password stored"
      );
    });

    it("should throw error if password verification fails", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUserId,
        email: mockUser.email,
        password: mockHashedPassword,
      });

      const credentials = { email: mockUser.email, password: "wrongPassword" };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should successfully login when credentials are valid", async () => {
      const fakeUser = {
        id: mockUserId,
        email: mockUser.email,
        password: mockHashedPassword,
        emailVerified: new Date(),
        imageUrl: "http://example.com/avatar.png",
        twoFactorEnabled: false,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(fakeUser);

      const credentials = { email: mockUser.email, password: mockPassword };

      const result = await credentialsProvider.options.authorize(credentials, {});
      expect(result).toEqual({
        id: fakeUser.id,
        email: fakeUser.email,
        emailVerified: fakeUser.emailVerified,
        imageUrl: fakeUser.imageUrl,
      });
    });

    describe("Two-Factor Backup Code login", () => {
      it("should throw error if backup codes are missing", async () => {
        const mockUser = {
          id: mockUserId,
          email: "2fa@example.com",
          password: mockHashedPassword,
          twoFactorEnabled: true,
          backupCodes: null,
        };
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

        const credentials = { email: mockUser.email, password: mockPassword, backupCode: "123456" };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "No backup codes found"
        );
      });
    });
  });

  describe("CredentialsProvider (token) - Token-based email verification", () => {
    const tokenProvider = getProviderById("token");

    it("should throw error if token is not provided", async () => {
      await expect(tokenProvider.options.authorize({}, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    it("should throw error if token is invalid or user not found", async () => {
      const credentials = { token: "badtoken" };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    it("should throw error if email is already verified", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

      const credentials = { token: createToken(mockUser.id, mockUser.email) };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Email already verified"
      );
    });

    it("should update user and verify email when token is valid", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: mockUser.id, emailVerified: null });
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUser,
        password: mockHashedPassword,
        backupCodes: null,
        twoFactorSecret: null,
        identityProviderAccountId: null,
        groupId: null,
      });

      const credentials = { token: createToken(mockUserId, mockUser.email) };

      const result = await tokenProvider.options.authorize(credentials, {});
      expect(result.email).toBe(mockUser.email);
      expect(result.emailVerified).toBeInstanceOf(Date);
    });
  });

  describe("Callbacks", () => {
    describe("jwt callback", () => {
      it("should add profile information to token if user is found", async () => {
        vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
          id: mockUser.id,
          locale: mockUser.locale,
          email: mockUser.email,
          emailVerified: mockUser.emailVerified,
        });

        const token = { email: mockUser.email };
        if (!authOptions.callbacks?.jwt) {
          throw new Error("jwt callback is not defined");
        }
        const result = await authOptions.callbacks.jwt({ token } as any);
        expect(result).toEqual({
          ...token,
          profile: { id: mockUser.id },
        });
      });

      it("should return token unchanged if no existing user is found", async () => {
        vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

        const token = { email: "nonexistent@example.com" };
        if (!authOptions.callbacks?.jwt) {
          throw new Error("jwt callback is not defined");
        }
        const result = await authOptions.callbacks.jwt({ token } as any);
        expect(result).toEqual(token);
      });
    });

    describe("session callback", () => {
      it("should add user profile to session", async () => {
        const token = {
          id: "user6",
          profile: { id: "user6", email: "user6@example.com" },
        };

        const session = { user: {} };
        if (!authOptions.callbacks?.session) {
          throw new Error("session callback is not defined");
        }
        const result = await authOptions.callbacks.session({ session, token } as any);
        expect(result.user).toEqual(token.profile);
      });
    });

    describe("signIn callback", () => {
      it("should throw error if email is not verified and email verification is enabled", async () => {
        const user = { ...mockUser, emailVerified: null };
        const account = { provider: "credentials" } as any;
        // EMAIL_VERIFICATION_DISABLED is imported from constants.
        if (!EMAIL_VERIFICATION_DISABLED && authOptions.callbacks?.signIn) {
          await expect(authOptions.callbacks.signIn({ user, account })).rejects.toThrow(
            "Email Verification is Pending"
          );
        }
      });
    });
  });

  describe("Two-Factor Authentication (TOTP)", () => {
    const credentialsProvider = getProviderById("credentials");

    it("should throw error if TOTP code is missing when 2FA is enabled", async () => {
      const mockUser = {
        id: mockUserId,
        email: "2fa@example.com",
        password: mockHashedPassword,
        twoFactorEnabled: true,
        twoFactorSecret: "encrypted_secret",
      };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "second factor required"
      );
    });

    it("should throw error if two factor secret is missing", async () => {
      const mockUser = {
        id: mockUserId,
        email: "2fa@example.com",
        password: mockHashedPassword,
        twoFactorEnabled: true,
        twoFactorSecret: null,
      };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

      const credentials = {
        email: mockUser.email,
        password: mockPassword,
        totpCode: "123456",
      };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Internal Server Error"
      );
    });
  });
});
