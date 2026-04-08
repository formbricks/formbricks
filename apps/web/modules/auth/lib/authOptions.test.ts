import { randomBytes } from "crypto";
import { Provider } from "next-auth/providers/index";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
// Import mocked rate limiting functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { authOptions } from "./authOptions";
import { mockUser } from "./mock-data";

const TEST_TIMEOUT_MS = 15_000;
const authUtilsMocks = vi.hoisted(() => ({
  logAuthAttempt: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthSuccess: vi.fn(),
  logEmailVerificationAttempt: vi.fn(),
  logTwoFactorAttempt: vi.fn(),
  shouldLogAuthFailure: vi.fn(),
  verifyPassword: vi.fn(),
}));

// Mock encryption utilities
vi.mock("@/lib/encryption", () => ({
  symmetricEncrypt: vi.fn((value: string) => `encrypted_${value}`),
  symmetricDecrypt: vi.fn((value: string) => value.replace("encrypted_", "")),
}));

// Mock JWT
vi.mock("@/lib/jwt");

vi.mock("@/modules/auth/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();

  return {
    ...actual,
    logAuthAttempt: authUtilsMocks.logAuthAttempt,
    logAuthEvent: authUtilsMocks.logAuthEvent,
    logAuthSuccess: authUtilsMocks.logAuthSuccess,
    logEmailVerificationAttempt: authUtilsMocks.logEmailVerificationAttempt,
    logTwoFactorAttempt: authUtilsMocks.logTwoFactorAttempt,
    shouldLogAuthFailure: authUtilsMocks.shouldLogAuthFailure,
    verifyPassword: authUtilsMocks.verifyPassword,
  };
});

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

// Mock constants that this test needs while preserving untouched exports.
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    EMAIL_VERIFICATION_DISABLED: false,
    SESSION_MAX_AGE: 86400,
    NEXTAUTH_SECRET: "test-secret",
    WEBAPP_URL: "http://localhost:3000",
    ENCRYPTION_KEY: "12345678901234567890123456789012", // 32 bytes for AES-256
    REDIS_URL: undefined,
    AUDIT_LOG_ENABLED: false,
    AUDIT_LOG_GET_USER_IP: false,
    ENTERPRISE_LICENSE_KEY: undefined,
    SENTRY_DSN: undefined,
    BREVO_API_KEY: undefined,
    RATE_LIMITING_DISABLED: false,
    CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
  };
});

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
const mockHashedPassword = "hashed-password";

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
  beforeEach(() => {
    authUtilsMocks.shouldLogAuthFailure.mockResolvedValue(false);
    authUtilsMocks.verifyPassword.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("CredentialsProvider (credentials) - email/password login", () => {
    const credentialsProvider = getProviderById("credentials");

    test(
      "should throw error if credentials are not provided",
      async () => {
        await expect(credentialsProvider.options.authorize(undefined, {})).rejects.toThrow(
          "Invalid credentials"
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should throw error if user not found",
      async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

        const credentials = { email: mockUser.email, password: mockPassword };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Invalid credentials"
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should throw error if user has no password stored",
      async () => {
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
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should throw error if password verification fails",
      async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
        authUtilsMocks.verifyPassword.mockResolvedValue(false);
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: mockUserId,
          email: mockUser.email,
          password: mockHashedPassword,
        } as any);

        const credentials = { email: mockUser.email, password: "wrongPassword" };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Invalid credentials"
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should successfully login when credentials are valid",
      async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
        const fakeUser = {
          id: mockUserId,
          email: mockUser.email,
          password: mockHashedPassword,
          emailVerified: new Date(),
          twoFactorEnabled: false,
        };

        vi.spyOn(prisma.user, "findUnique").mockResolvedValue(fakeUser as any);

        const credentials = { email: mockUser.email, password: mockPassword };

        const result = await credentialsProvider.options.authorize(credentials, {});
        expect(result).toEqual({
          id: fakeUser.id,
          email: fakeUser.email,
          emailVerified: fakeUser.emailVerified,
        });
      },
      TEST_TIMEOUT_MS
    );

    describe("Rate Limiting", () => {
      test(
        "should apply rate limiting before credential validation",
        async () => {
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
        },
        TEST_TIMEOUT_MS
      );

      test(
        "should block login when rate limit exceeded",
        async () => {
          vi.mocked(applyIPRateLimit).mockRejectedValue(
            new Error("Maximum number of requests reached. Please try again later.")
          );
          const findUniqueSpy = vi.spyOn(prisma.user, "findUnique");

          const credentials = { email: mockUser.email, password: mockPassword };

          await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
            "Maximum number of requests reached. Please try again later."
          );

          expect(findUniqueSpy).not.toHaveBeenCalled();
        },
        TEST_TIMEOUT_MS
      );

      test(
        "should use correct rate limit configuration",
        async () => {
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
        },
        TEST_TIMEOUT_MS
      );
    });

    describe("Two-Factor Backup Code login", () => {
      test(
        "should throw error if backup codes are missing",
        async () => {
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
        },
        TEST_TIMEOUT_MS
      );
    });
  });

  describe("CredentialsProvider (token) - Token-based email verification", () => {
    const tokenProvider = getProviderById("token");

    test(
      "should throw error if token is not provided",
      async () => {
        await expect(tokenProvider.options.authorize({}, {})).rejects.toThrow(
          "Either a user does not match the provided token or the token is invalid"
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should throw error if token is invalid or user not found",
      async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue(); // Rate limiting passes
        const credentials = { token: "badtoken" };

        await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Either a user does not match the provided token or the token is invalid"
        );
      },
      TEST_TIMEOUT_MS
    );

    describe("Rate Limiting", () => {
      test(
        "should apply rate limiting before token verification",
        async () => {
          vi.mocked(applyIPRateLimit).mockResolvedValue();

          const credentials = { token: "sometoken" };

          await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow();

          expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
        },
        TEST_TIMEOUT_MS
      );

      test(
        "should block verification when rate limit exceeded",
        async () => {
          vi.mocked(applyIPRateLimit).mockRejectedValue(
            new Error("Maximum number of requests reached. Please try again later.")
          );
          const findUniqueSpy = vi.spyOn(prisma.user, "findUnique");

          const credentials = { token: "sometoken" };

          await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
            "Maximum number of requests reached. Please try again later."
          );

          expect(findUniqueSpy).not.toHaveBeenCalled();
        },
        TEST_TIMEOUT_MS
      );
    });
  });

  describe("Callbacks", () => {
    describe("jwt callback", () => {
      test(
        "should add profile information to token if user is found",
        async () => {
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
        },
        TEST_TIMEOUT_MS
      );

      test(
        "should return token unchanged if no existing user is found",
        async () => {
          vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

          const token = { email: "nonexistent@example.com" };
          if (!authOptions.callbacks?.jwt) {
            throw new Error("jwt callback is not defined");
          }
          const result = await authOptions.callbacks.jwt({ token } as any);
          expect(result).toEqual(token);
        },
        TEST_TIMEOUT_MS
      );
    });

    describe("session callback", () => {
      test(
        "should add user profile to session",
        async () => {
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
        },
        TEST_TIMEOUT_MS
      );
    });

    describe("signIn callback", () => {
      test(
        "should throw error if email is not verified and email verification is enabled",
        async () => {
          const user = { ...mockUser, emailVerified: null };
          const account = { provider: "credentials" } as any;
          // EMAIL_VERIFICATION_DISABLED is imported from constants.
          if (!EMAIL_VERIFICATION_DISABLED && authOptions.callbacks?.signIn) {
            await expect(authOptions.callbacks.signIn({ user, account })).rejects.toThrow(
              "Email Verification is Pending"
            );
          }
        },
        TEST_TIMEOUT_MS
      );
    });
  });

  describe("Two-Factor Authentication (TOTP)", () => {
    const credentialsProvider = getProviderById("credentials");

    test(
      "should throw error if TOTP code is missing when 2FA is enabled",
      async () => {
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
      },
      TEST_TIMEOUT_MS
    );

    test(
      "should throw error if two factor secret is missing",
      async () => {
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
      },
      TEST_TIMEOUT_MS
    );
  });
});
