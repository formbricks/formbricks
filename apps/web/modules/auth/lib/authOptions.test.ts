import { randomBytes } from "crypto";
import { Provider } from "next-auth/providers/index";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { verifyToken } from "@/lib/jwt";
import { capturePostHogEvent } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
// Import mocked rate limiting functions
import { updateUser, updateUserLastLoginAt } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { authOptions } from "./authOptions";
import { mockUser } from "./mock-data";
import { hashPassword } from "./utils";

vi.mock("@next-auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    linkAccount: vi.fn(),
    unlinkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn(),
  })),
}));

// Mock encryption utilities
vi.mock("@/lib/encryption", () => ({
  symmetricEncrypt: vi.fn((value: string) => `encrypted_${value}`),
  symmetricDecrypt: vi.fn((value: string) => value.replace("encrypted_", "")),
}));

vi.mock("@/lib/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto")>();
  return {
    ...actual,
    symmetricEncrypt: vi.fn((value: string) => `encrypted_${value}`),
    symmetricDecrypt: vi.fn((value: string) => value.replace("encrypted_", "")),
  };
});

// Mock JWT
vi.mock("@/lib/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
  completeAccountDeletionSsoReauthentication: vi.fn(),
  getAccountDeletionSsoReauthFailureRedirectUrl: vi.fn(),
  getAccountDeletionSsoReauthIntentFromCallbackUrl: vi.fn(),
  validateAccountDeletionSsoReauthenticationCallback: vi.fn(),
}));

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
    POSTHOG_KEY: "phc_test_key",
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
const mockHashedPassword = await hashPassword(mockPassword);

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    membership: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/lib/user", () => ({
  updateUser: vi.fn(),
  updateUserLastLoginAt: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/brevo", () => ({
  createBrevoCustomer: vi.fn(),
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
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    }, 15000);

    test("should throw generic invalid credentials error if user has no password stored", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        password: null,
      } as any);

      const credentials = { email: mockUser.email, password: mockPassword };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    }, 15000);

    test("should throw error if password verification fails", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: mockUserId,
        email: mockUser.email,
        password: mockHashedPassword,
      } as any);

      const credentials = { email: mockUser.email, password: "wrongPassword" };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    }, 15000);

    test("should successfully login when credentials are valid", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
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
    }, 15000);

    describe("Rate Limiting", () => {
      test("should apply rate limiting before credential validation", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
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
        vi.mocked(applyIPRateLimit).mockRejectedValue(
          new Error("Maximum number of requests reached. Please try again later.")
        );
        const findUniqueSpy = vi.spyOn(prisma.user, "findUnique");

        const credentials = { email: mockUser.email, password: mockPassword };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Maximum number of requests reached. Please try again later."
        );

        expect(findUniqueSpy).not.toHaveBeenCalled();
      });

      test("should use correct rate limit configuration", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
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
        vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
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
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
      const credentials = { token: "badtoken" };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    test("allows verified users through the token provider when the token purpose is sso_recovery", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
      vi.mocked(verifyToken).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        purpose: "sso_recovery",
      } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUser,
        emailVerified: new Date(),
      } as any);

      const result = await tokenProvider.options.authorize({ token: "recovery-token" }, {});

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          authFlowPurpose: "sso_recovery",
        })
      );
    });

    test("defers verification side effects for unverified users when the token purpose is sso_recovery", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
      vi.mocked(verifyToken).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        purpose: "sso_recovery",
      } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUser,
        emailVerified: null,
      } as any);

      const result = await tokenProvider.options.authorize({ token: "recovery-token" }, {});

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          emailVerified: null,
          authFlowPurpose: "sso_recovery",
        })
      );
      expect(updateUser).not.toHaveBeenCalled();
    });

    test("verifies unverified users during the standard email verification flow", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
      vi.mocked(verifyToken).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        purpose: "email_verification",
      } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUser,
        emailVerified: null,
      } as any);
      vi.mocked(updateUser).mockResolvedValue({
        ...mockUser,
        emailVerified: new Date("2026-04-16T00:00:00.000Z"),
      } as any);

      const result = await tokenProvider.options.authorize({ token: "verify-token" }, {});

      expect(updateUser).toHaveBeenCalledWith(mockUser.id, { emailVerified: expect.any(Date) });
      expect(createBrevoCustomer).toHaveBeenCalledWith({ id: mockUser.id, email: mockUser.email });
      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          authFlowPurpose: "email_verification",
          emailVerified: new Date("2026-04-16T00:00:00.000Z"),
        })
      );
    });

    test("rejects inactive users even when the verification token is otherwise valid", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
      vi.mocked(verifyToken).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        purpose: "email_verification",
      } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockUser,
        emailVerified: null,
        isActive: false,
      } as any);

      await expect(tokenProvider.options.authorize({ token: "inactive-token" }, {})).rejects.toThrow(
        "Your account is currently inactive. Please contact the organization admin."
      );

      expect(updateUser).not.toHaveBeenCalled();
      expect(createBrevoCustomer).not.toHaveBeenCalled();
    });

    describe("Rate Limiting", () => {
      test("should apply rate limiting before token verification", async () => {
        vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });

        const credentials = { token: "sometoken" };

        await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow();

        expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
      });

      test("should block verification when rate limit exceeded", async () => {
        vi.mocked(applyIPRateLimit).mockRejectedValue(
          new Error("Maximum number of requests reached. Please try again later.")
        );
        const findUniqueSpy = vi.spyOn(prisma.user, "findUnique");

        const credentials = { token: "sometoken" };

        await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
          "Maximum number of requests reached. Please try again later."
        );

        expect(findUniqueSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe("Callbacks", () => {
    describe("session callback", () => {
      test("should add user id and isActive to session from database user", async () => {
        const session = { user: { email: "user6@example.com" } };
        const user = { id: "user6", isActive: false };

        if (!authOptions.callbacks?.session) {
          throw new Error("session callback is not defined");
        }
        const result = await authOptions.callbacks.session({ session, user } as any);
        expect(result.user).toEqual({
          email: "user6@example.com",
          id: "user6",
          isActive: false,
        });
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

      test("should capture user_signed_in PostHog event on successful credentials sign-in", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const user = { ...mockUser, emailVerified: new Date() };
        const account = { provider: "credentials" } as any;

        vi.mocked(prisma.membership.count).mockResolvedValue(2);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ lastLoginAt: yesterday } as any);

        if (authOptions.callbacks?.signIn) {
          const result = await authOptions.callbacks.signIn({ user, account });
          expect(result).toBe(true);

          // Allow the fire-and-forget captureSignIn to resolve
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(capturePostHogEvent).toHaveBeenCalledWith(user.id, "user_signed_in", {
            auth_provider: "credentials",
            organization_count: 2,
            is_first_login_today: true,
          });
        }
      });

      test("should set is_first_login_today to false when user already logged in today", async () => {
        const user = { ...mockUser, emailVerified: new Date() };
        const account = { provider: "credentials" } as any;

        vi.mocked(prisma.membership.count).mockResolvedValue(1);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ lastLoginAt: new Date() } as any);

        if (authOptions.callbacks?.signIn) {
          await authOptions.callbacks.signIn({ user, account });
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(capturePostHogEvent).toHaveBeenCalledWith(
            user.id,
            "user_signed_in",
            expect.objectContaining({ is_first_login_today: false })
          );
        }
      });

      test("should not throw if captureSignIn prisma query fails", async () => {
        const user = { ...mockUser, emailVerified: new Date() };
        const account = { provider: "credentials" } as any;

        vi.mocked(prisma.membership.count).mockRejectedValue(new Error("DB error"));

        if (authOptions.callbacks?.signIn) {
          const result = await authOptions.callbacks.signIn({ user, account });
          expect(result).toBe(true);

          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(capturePostHogEvent).not.toHaveBeenCalled();
        }
      });

      test("should not record a completed sign-in while the recovery token is only proving inbox ownership", async () => {
        const user = {
          ...mockUser,
          emailVerified: new Date(),
          authFlowPurpose: "sso_recovery",
        };
        const account = { provider: "token" } as any;

        if (authOptions.callbacks?.signIn) {
          const result = await authOptions.callbacks.signIn({ user, account } as any);

          expect(result).toBe(true);
          expect(updateUserLastLoginAt).not.toHaveBeenCalled();
          expect(capturePostHogEvent).not.toHaveBeenCalled();
        }
      });

      test("should allow an unverified recovery session through until SSO completion finishes the reclaim", async () => {
        const user = {
          ...mockUser,
          emailVerified: null,
          authFlowPurpose: "sso_recovery",
        };
        const account = { provider: "token" } as any;

        if (authOptions.callbacks?.signIn) {
          const result = await authOptions.callbacks.signIn({ user, account } as any);

          expect(result).toBe(true);
          expect(updateUserLastLoginAt).not.toHaveBeenCalled();
          expect(capturePostHogEvent).not.toHaveBeenCalled();
        }
      });

      test("should finalize successful sign-in when no provider information is available", async () => {
        const user = { ...mockUser, emailVerified: new Date() };

        if (authOptions.callbacks?.signIn) {
          const result = await authOptions.callbacks.signIn({ user, account: undefined } as any);

          expect(result).toBe(true);
          expect(updateUserLastLoginAt).toHaveBeenCalledWith(user.email);
        }
      });
    });
  });

  describe("Enterprise SSO signIn callback", () => {
    test("should not update lastLoginAt when SSO sign-in is denied", async () => {
      vi.resetModules();

      const mockHandleSsoCallback = vi.fn().mockRejectedValueOnce(new Error("OAuthAccountNotLinked"));
      const mockUpdateUserLastLoginAt = vi.fn();
      const mockCapturePostHogEvent = vi.fn();

      vi.doMock("@/lib/constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/lib/constants")>();
        return {
          ...actual,
          EMAIL_VERIFICATION_DISABLED: false,
          SESSION_MAX_AGE: 86400,
          NEXTAUTH_SECRET: "test-secret",
          WEBAPP_URL: "http://localhost:3000",
          ENCRYPTION_KEY: "12345678901234567890123456789012",
          REDIS_URL: undefined,
          AUDIT_LOG_ENABLED: false,
          AUDIT_LOG_GET_USER_IP: false,
          ENTERPRISE_LICENSE_KEY: "test-enterprise-license",
          SENTRY_DSN: undefined,
          BREVO_API_KEY: undefined,
          RATE_LIMITING_DISABLED: false,
          CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
          POSTHOG_KEY: "phc_test_key",
        };
      });
      vi.doMock("@/modules/ee/sso/lib/providers", () => ({
        getSSOProviders: vi.fn(() => []),
      }));
      vi.doMock("@/modules/ee/sso/lib/sso-handlers", () => ({
        handleSsoCallback: mockHandleSsoCallback,
      }));
      vi.doMock("@/modules/auth/lib/user", () => ({
        updateUser: vi.fn(),
        updateUserLastLoginAt: mockUpdateUserLastLoginAt,
      }));
      vi.doMock("@/lib/posthog", () => ({
        capturePostHogEvent: mockCapturePostHogEvent,
      }));

      const { authOptions: enterpriseAuthOptions } = await import("./authOptions");
      const user = { ...mockUser, emailVerified: new Date() };
      const account = { provider: "google", type: "oauth", providerAccountId: "provider-123" } as any;

      await expect(enterpriseAuthOptions.callbacks?.signIn?.({ user, account } as any)).rejects.toThrow(
        "OAuthAccountNotLinked"
      );

      expect(mockHandleSsoCallback).toHaveBeenCalled();
      expect(mockUpdateUserLastLoginAt).not.toHaveBeenCalled();
      expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
    });

    test("should finalize successful sign-in after a successful enterprise SSO callback", async () => {
      vi.resetModules();

      const mockHandleSsoCallback = vi.fn().mockResolvedValueOnce(true);
      const mockUpdateUserLastLoginAt = vi.fn();
      const mockCapturePostHogEvent = vi.fn();

      vi.doMock("@/lib/constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/lib/constants")>();
        return {
          ...actual,
          EMAIL_VERIFICATION_DISABLED: false,
          SESSION_MAX_AGE: 86400,
          NEXTAUTH_SECRET: "test-secret",
          WEBAPP_URL: "http://localhost:3000",
          ENCRYPTION_KEY: "12345678901234567890123456789012",
          REDIS_URL: undefined,
          AUDIT_LOG_ENABLED: false,
          AUDIT_LOG_GET_USER_IP: false,
          ENTERPRISE_LICENSE_KEY: "test-enterprise-license",
          SENTRY_DSN: undefined,
          BREVO_API_KEY: undefined,
          RATE_LIMITING_DISABLED: false,
          CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
          POSTHOG_KEY: "phc_test_key",
        };
      });
      vi.doMock("@/modules/ee/sso/lib/providers", () => ({
        getSSOProviders: vi.fn(() => []),
      }));
      vi.doMock("@/modules/ee/sso/lib/sso-handlers", () => ({
        handleSsoCallback: mockHandleSsoCallback,
      }));
      vi.doMock("@/modules/auth/lib/user", () => ({
        updateUser: vi.fn(),
        updateUserLastLoginAt: mockUpdateUserLastLoginAt,
      }));
      vi.doMock("@/lib/posthog", () => ({
        capturePostHogEvent: mockCapturePostHogEvent,
      }));

      const { authOptions: enterpriseAuthOptions } = await import("./authOptions");
      const user = { ...mockUser, emailVerified: new Date() };
      const account = { provider: "google", type: "oauth", providerAccountId: "provider-123" } as any;

      await expect(enterpriseAuthOptions.callbacks?.signIn?.({ user, account } as any)).resolves.toBe(true);

      expect(mockHandleSsoCallback).toHaveBeenCalled();
      expect(mockUpdateUserLastLoginAt).toHaveBeenCalledWith(user.email);
    });

    test("should complete account deletion SSO reauthentication before finalizing sign-in", async () => {
      vi.resetModules();

      const mockHandleSsoCallback = vi.fn().mockResolvedValueOnce(true);
      const mockUpdateUserLastLoginAt = vi.fn();
      const mockCapturePostHogEvent = vi.fn();
      const mockCompleteAccountDeletionSsoReauthentication = vi.fn().mockResolvedValueOnce(undefined);
      const mockGetAccountDeletionSsoReauthIntentFromCallbackUrl = vi
        .fn()
        .mockReturnValueOnce("intent-token");
      const mockValidateAccountDeletionSsoReauthenticationCallback = vi.fn().mockResolvedValueOnce(undefined);

      vi.doMock("@/lib/constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/lib/constants")>();
        return {
          ...actual,
          EMAIL_VERIFICATION_DISABLED: false,
          SESSION_MAX_AGE: 86400,
          NEXTAUTH_SECRET: "test-secret",
          WEBAPP_URL: "http://localhost:3000",
          ENCRYPTION_KEY: "12345678901234567890123456789012",
          REDIS_URL: undefined,
          AUDIT_LOG_ENABLED: false,
          AUDIT_LOG_GET_USER_IP: false,
          ENTERPRISE_LICENSE_KEY: "test-enterprise-license",
          SENTRY_DSN: undefined,
          BREVO_API_KEY: undefined,
          RATE_LIMITING_DISABLED: false,
          CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
          POSTHOG_KEY: "phc_test_key",
        };
      });
      vi.doMock("@/modules/ee/sso/lib/providers", () => ({
        getSSOProviders: vi.fn(() => []),
      }));
      vi.doMock("@/modules/ee/sso/lib/sso-handlers", () => ({
        handleSsoCallback: mockHandleSsoCallback,
      }));
      vi.doMock("@/modules/auth/lib/user", () => ({
        updateUser: vi.fn(),
        updateUserLastLoginAt: mockUpdateUserLastLoginAt,
      }));
      vi.doMock("@/lib/posthog", () => ({
        capturePostHogEvent: mockCapturePostHogEvent,
      }));
      vi.doMock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
        completeAccountDeletionSsoReauthentication: mockCompleteAccountDeletionSsoReauthentication,
        getAccountDeletionSsoReauthIntentFromCallbackUrl:
          mockGetAccountDeletionSsoReauthIntentFromCallbackUrl,
        validateAccountDeletionSsoReauthenticationCallback:
          mockValidateAccountDeletionSsoReauthenticationCallback,
      }));

      const { authOptions: enterpriseAuthOptions } = await import("./authOptions");
      const user = { ...mockUser, emailVerified: new Date() };
      const account = { provider: "google", type: "oauth", providerAccountId: "provider-123" } as any;

      await expect(enterpriseAuthOptions.callbacks?.signIn?.({ user, account } as any)).resolves.toBe(true);

      expect(mockHandleSsoCallback).toHaveBeenCalled();
      expect(mockGetAccountDeletionSsoReauthIntentFromCallbackUrl).toHaveBeenCalled();
      expect(mockValidateAccountDeletionSsoReauthenticationCallback).toHaveBeenCalledWith({
        account,
        intentToken: "intent-token",
      });
      expect(mockCompleteAccountDeletionSsoReauthentication).toHaveBeenCalledWith({
        account,
        intentToken: "intent-token",
      });
      expect(mockUpdateUserLastLoginAt).toHaveBeenCalledWith(user.email);
    });

    test("should redirect account deletion SSO reauthentication failures back to the profile page", async () => {
      vi.resetModules();

      const mockHandleSsoCallback = vi.fn();
      const mockUpdateUserLastLoginAt = vi.fn();
      const mockCapturePostHogEvent = vi.fn();
      const mockCompleteAccountDeletionSsoReauthentication = vi.fn();
      const mockGetAccountDeletionSsoReauthFailureRedirectUrl = vi
        .fn()
        .mockReturnValueOnce(
          "http://localhost:3000/environments/env-id/settings/profile?accountDeletionError=google_reauth_not_configured"
        );
      const mockGetAccountDeletionSsoReauthIntentFromCallbackUrl = vi
        .fn()
        .mockReturnValueOnce("intent-token");
      const reauthError = new Error(
        "Google account deletion requires Google Auth Platform Session age claims to be enabled."
      );
      const mockValidateAccountDeletionSsoReauthenticationCallback = vi
        .fn()
        .mockRejectedValueOnce(reauthError);

      vi.doMock("@/lib/constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/lib/constants")>();
        return {
          ...actual,
          EMAIL_VERIFICATION_DISABLED: false,
          SESSION_MAX_AGE: 86400,
          NEXTAUTH_SECRET: "test-secret",
          WEBAPP_URL: "http://localhost:3000",
          ENCRYPTION_KEY: "12345678901234567890123456789012",
          REDIS_URL: undefined,
          AUDIT_LOG_ENABLED: false,
          AUDIT_LOG_GET_USER_IP: false,
          ENTERPRISE_LICENSE_KEY: "test-enterprise-license",
          SENTRY_DSN: undefined,
          BREVO_API_KEY: undefined,
          RATE_LIMITING_DISABLED: false,
          CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
          POSTHOG_KEY: "phc_test_key",
        };
      });
      vi.doMock("@/modules/ee/sso/lib/providers", () => ({
        getSSOProviders: vi.fn(() => []),
      }));
      vi.doMock("@/modules/ee/sso/lib/sso-handlers", () => ({
        handleSsoCallback: mockHandleSsoCallback,
      }));
      vi.doMock("@/modules/auth/lib/user", () => ({
        updateUser: vi.fn(),
        updateUserLastLoginAt: mockUpdateUserLastLoginAt,
      }));
      vi.doMock("@/lib/posthog", () => ({
        capturePostHogEvent: mockCapturePostHogEvent,
      }));
      vi.doMock("@/modules/account/lib/account-deletion-sso-reauth", () => ({
        completeAccountDeletionSsoReauthentication: mockCompleteAccountDeletionSsoReauthentication,
        getAccountDeletionSsoReauthFailureRedirectUrl: mockGetAccountDeletionSsoReauthFailureRedirectUrl,
        getAccountDeletionSsoReauthIntentFromCallbackUrl:
          mockGetAccountDeletionSsoReauthIntentFromCallbackUrl,
        validateAccountDeletionSsoReauthenticationCallback:
          mockValidateAccountDeletionSsoReauthenticationCallback,
      }));

      const { authOptions: enterpriseAuthOptions } = await import("./authOptions");
      const user = { ...mockUser, emailVerified: new Date() };
      const account = { provider: "google", type: "oauth", providerAccountId: "provider-123" } as any;

      await expect(enterpriseAuthOptions.callbacks?.signIn?.({ user, account } as any)).resolves.toBe(
        "http://localhost:3000/environments/env-id/settings/profile?accountDeletionError=google_reauth_not_configured"
      );

      expect(mockGetAccountDeletionSsoReauthFailureRedirectUrl).toHaveBeenCalledWith({
        error: reauthError,
        intentToken: "intent-token",
      });
      expect(mockHandleSsoCallback).not.toHaveBeenCalled();
      expect(mockCompleteAccountDeletionSsoReauthentication).not.toHaveBeenCalled();
      expect(mockUpdateUserLastLoginAt).not.toHaveBeenCalled();
    });
  });

  describe("Two-Factor Authentication (TOTP)", () => {
    const credentialsProvider = getProviderById("credentials");

    test("should throw error if TOTP code is missing when 2FA is enabled", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
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
      vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true }); // Rate limiting passes
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
