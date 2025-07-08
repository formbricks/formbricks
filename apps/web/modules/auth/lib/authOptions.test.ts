import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { createToken } from "@/lib/jwt";
// Import mocked rate limiting functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { randomBytes } from "crypto";
import { Provider } from "next-auth/providers/index";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { authOptions } from "./authOptions";
import { mockUser } from "./mock-data";
import { hashPassword } from "./utils";

// Mock rate limiting dependencies
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    auth: {
      login: { interval: 900, allowedPerInterval: 30, namespace: "auth:login" },
      verifyEmail: { interval: 3600, allowedPerInterval: 10, namespace: "auth:verify" },
    },
  },
}));

// Mock constants that this test needs
vi.mock("@/lib/constants", () => ({
  EMAIL_VERIFICATION_DISABLED: false,
  SESSION_MAX_AGE: 86400,
  NEXTAUTH_SECRET: "test-secret",
  WEBAPP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
  REDIS_URL: undefined,
  AUDIT_LOG_ENABLED: false,
  AUDIT_LOG_GET_USER_IP: false,
  ENTERPRISE_LICENSE_KEY: undefined,
  SENTRY_DSN: undefined,
  BREVO_API_KEY: undefined,
  RATE_LIMITING_DISABLED: false,
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => ({
    get: () => null,
    has: () => false,
    keys: () => [],
    values: () => [],
    entries: () => [],
    forEach: () => {},
  }),
  cookies: () => ({
    get: (name: string) => {
      if (name === "next-auth.callback-url") {
        return { value: "/" };
      }
      return null;
    },
  }),
}));

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
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("CredentialsProvider (credentials) - email/password login", () => {
    const credentialsProvider = getProviderById("credentials");

    test("should throw error if credentials are not provided", async () => {
      await expect(credentialsProvider.options.authorize(undefined, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    test("should throw error if user not found", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    test("should throw error if user has no password stored", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        password: null,
      } as any);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "User has no password stored"
      );
    });

    test("should throw error if password verification fails", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUserId,
        email: mockUser.email,
        password: mockHashedPassword,
      } as any);

      const credentials = { email: mockUser.email, password: "wrongPassword" };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    test("should successfully login when credentials are valid", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      const fakeUser = {
        id: mockUserId,
        email: mockUser.email,
        password: mockHashedPassword,
        emailVerified: new Date(),
        imageUrl: "http://example.com/avatar.png",
        twoFactorEnabled: false,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(fakeUser as any);

      const credentials = { email: mockUser.email, password: mockPassword };

      const result = await credentialsProvider.options.authorize(credentials, {});
      expect(result).toEqual({
        id: fakeUser.id,
        email: fakeUser.email,
        emailVerified: fakeUser.emailVerified,
        imageUrl: fakeUser.imageUrl,
      });
    });

    describe("Rate Limiting", () => {
      test("should apply rate limiting before credential validation", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue();
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: mockUserId,
          email: mockUser.email,
          password: mockHashedPassword,
          emailVerified: new Date(),
          twoFactorEnabled: false,
        } as any);

        const credentials = { email: mockUser.email, password: mockPassword };

        await credentialsProvider.options.authorize(credentials, {});

        expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.login);
        expect(applyIPRateLimit).toHaveBeenCalledBefore(prisma.user.findUnique as any);
      });

      test("should block login when rate limit exceeded", async () => {
        vi.mocked(applyIPRateLimit).mockRejectedValue(new Error("Rate limit exceeded"));

        const credentials = { email: mockUser.email, password: mockPassword };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Rate limit exceeded"
        );

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });

      test("should use correct rate limit configuration", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue();
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: mockUserId,
          email: mockUser.email,
          password: mockHashedPassword,
          emailVerified: new Date(),
          twoFactorEnabled: false,
        } as any);

        const credentials = { email: mockUser.email, password: mockPassword };

        await credentialsProvider.options.authorize(credentials, {});

        expect(applyIPRateLimit).toHaveBeenCalledWith({
          interval: 900,
          allowedPerInterval: 30,
          namespace: "auth:login",
        });
      });
    });

    describe("Two-Factor Backup Code login", () => {
      test("should throw error if backup codes are missing", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
        const mockUser = {
          id: mockUserId,
          email: "2fa@example.com",
          password: mockHashedPassword,
          twoFactorEnabled: true,
          backupCodes: null,
        };
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

        const credentials = { email: mockUser.email, password: mockPassword, backupCode: "123456" };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "No backup codes found"
        );
      });
    });
  });

  describe("CredentialsProvider (token) - Token-based email verification", () => {
    const tokenProvider = getProviderById("token");

    test("should throw error if token is not provided", async () => {
      await expect(tokenProvider.options.authorize({}, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    test("should throw error if token is invalid or user not found", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      const credentials = { token: "badtoken" };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    test("should throw error if email is already verified", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const credentials = { token: createToken(mockUser.id, mockUser.email) };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Email already verified"
      );
    });

    test("should update user and verify email when token is valid", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: mockUser.id, emailVerified: null } as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUser,
        password: mockHashedPassword,
        backupCodes: null,
        twoFactorSecret: null,
        identityProviderAccountId: null,
        groupId: null,
      } as any);

      const credentials = { token: createToken(mockUserId, mockUser.email) };

      const result = await tokenProvider.options.authorize(credentials, {});
      expect(result.email).toBe(mockUser.email);
      expect(result.emailVerified).toBeInstanceOf(Date);
    });

    describe("Rate Limiting", () => {
      test("should apply rate limiting before token verification", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue();
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: mockUser.id,
          emailVerified: null,
        } as any);
        vi.spyOn(prisma.user, "update").mockResolvedValue({
          ...mockUser,
          password: mockHashedPassword,
          backupCodes: null,
          twoFactorSecret: null,
          identityProviderAccountId: null,
          groupId: null,
        } as any);

        const credentials = { token: createToken(mockUserId, mockUser.email) };

        await tokenProvider.options.authorize(credentials, {});

        expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
      });

      test("should block verification when rate limit exceeded", async () => {
        vi.mocked(applyIPRateLimit).mockRejectedValue(new Error("Rate limit exceeded"));

        const credentials = { token: createToken(mockUserId, mockUser.email) };

        await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow("Rate limit exceeded");

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });

      test("should use correct rate limit configuration", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue();
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: mockUser.id,
          emailVerified: null,
        } as any);
        vi.spyOn(prisma.user, "update").mockResolvedValue({
          ...mockUser,
          password: mockHashedPassword,
          backupCodes: null,
          twoFactorSecret: null,
          identityProviderAccountId: null,
          groupId: null,
        } as any);

        const credentials = { token: createToken(mockUserId, mockUser.email) };

        await tokenProvider.options.authorize(credentials, {});

        expect(applyIPRateLimit).toHaveBeenCalledWith({
          interval: 3600,
          allowedPerInterval: 10,
          namespace: "auth:verify",
        });
      });
    });
  });

  describe("Callbacks", () => {
    describe("jwt callback", () => {
      test("should add profile information to token if user is found", async () => {
        vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
          id: mockUser.id,
          locale: mockUser.locale,
          email: mockUser.email,
          emailVerified: mockUser.emailVerified,
        } as any);

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

      test("should return token unchanged if no existing user is found", async () => {
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
      test("should add user profile to session", async () => {
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
      test("should throw error if email is not verified and email verification is enabled", async () => {
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

    test("should throw error if TOTP code is missing when 2FA is enabled", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      const mockUser = {
        id: mockUserId,
        email: "2fa@example.com",
        password: mockHashedPassword,
        twoFactorEnabled: true,
        twoFactorSecret: "encrypted_secret",
      };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "second factor required"
      );
    });

    test("should throw error if two factor secret is missing", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
      const mockUser = {
        id: mockUserId,
        email: "2fa@example.com",
        password: mockHashedPassword,
        twoFactorEnabled: true,
        twoFactorSecret: null,
      };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

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
