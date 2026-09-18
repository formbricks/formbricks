import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import {
  createAuditIdentifier,
  hashPassword,
  logAuthAttempt,
  logAuthEvent,
  logAuthSuccess,
  logEmailVerificationAttempt,
  logTwoFactorAttempt,
  shouldLogAuthFailure,
  verifyPassword,
} from "./utils";

const PASSWORD_HASH_TEST_TIMEOUT_MS = 45_000;

// Mock the audit event handler
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn().mockResolvedValue(undefined),
}));

// Mock crypto for consistent hash testing
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => "a".repeat(32)), // Mock 64-char hex string
    })),
  })),
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  SENTRY_DSN: "test-sentry-dsn",
  IS_PRODUCTION: true,
  REDIS_URL: "redis://localhost:6379",
  ENCRYPTION_KEY: "test-encryption-key",
}));

// Mock cache module
const { mockCache, mockLogger } = vi.hoisted(() => ({
  mockCache: {
    getRedisClient: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: mockCache,
}));

vi.mock("@formbricks/logger", () => ({
  logger: mockLogger,
}));

// Mock @formbricks/cache
vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    custom: vi.fn((namespace: string, ...parts: string[]) => `${namespace}:${parts.join(":")}`),
    rateLimit: {
      core: vi.fn(
        (namespace: string, identifier: string, bucketStart: number) =>
          `rate_limit:${namespace}:${identifier}:${bucketStart}`
      ),
    },
  },
}));

describe("Auth Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queueAuditEventBackground).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Password Utils", () => {
    const password = "password";
    const hashedPassword = "$2a$12$LZsLq.9nkZlU0YDPx2aLNelnwD/nyavqbewLN.5.Q5h/UxRD8Ymcy";

    test("should hash a password", async () => {
      const newHashedPassword = await hashPassword(password);

      expect(typeof newHashedPassword).toBe("string");
      expect(newHashedPassword).not.toBe(password);
      expect(newHashedPassword.length).toBe(60);
    }, 20000);

    test("should verify a correct password", async () => {
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    }, 20000);

    test("should reject an incorrect password", async () => {
      const isValid = await verifyPassword("WrongPassword123!", hashedPassword);
      expect(isValid).toBe(false);
    }, 20000);

    test("should handle empty password correctly", async () => {
      const isValid = await verifyPassword("", hashedPassword);
      expect(isValid).toBe(false);
    }, 20000);

    test("should handle empty hash correctly", async () => {
      const isValid = await verifyPassword(password, "");
      expect(isValid).toBe(false);
    });

    test(
      "should generate different hashes for same password",
      async () => {
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        expect(hash1).not.toBe(hash2);
        expect(await verifyPassword(password, hash1)).toBe(true);
        expect(await verifyPassword(password, hash2)).toBe(true);
      },
      PASSWORD_HASH_TEST_TIMEOUT_MS
    );

    test(
      "should hash complex passwords correctly",
      async () => {
        const complexPassword = "MyC0mpl3x!P@ssw0rd#2024$%^&*()";
        const hashedComplex = await hashPassword(complexPassword);

        expect(typeof hashedComplex).toBe("string");
        expect(hashedComplex.length).toBe(60);
        expect(await verifyPassword(complexPassword, hashedComplex)).toBe(true);
        expect(await verifyPassword("wrong", hashedComplex)).toBe(false);
      },
      PASSWORD_HASH_TEST_TIMEOUT_MS
    );

    test("should handle bcrypt errors gracefully and log warning", async () => {
      // Save the original bcryptjs implementation
      const originalModule = await import("bcryptjs");

      // Mock bcryptjs to throw an error on compare
      vi.doMock("bcryptjs", () => ({
        ...originalModule,
        compare: vi.fn().mockRejectedValue(new Error("Invalid salt version")),
        hash: originalModule.hash, // Keep hash working
      }));

      // Re-import the utils module to use the mocked bcryptjs
      const { verifyPassword: verifyPasswordMocked } = await import("./utils?t=" + Date.now());

      const password = "testPassword";
      const invalidHash = "invalid-hash-format";

      const result = await verifyPasswordMocked(password, invalidHash);

      // Should return false for security
      expect(result).toBe(false);

      // Should log warning with correct signature (Pino format: object first, then message)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        "Secret verification failed due to invalid hash format"
      );

      // Restore the module
      vi.doUnmock("bcryptjs");
    });
  });

  describe("Audit Identifier Utils", () => {
    test("should create a hashed identifier for email", () => {
      const email = "user@example.com";
      const identifier = createAuditIdentifier(email, "email");

      expect(identifier).toBe("email_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(identifier).not.toContain("user@example.com");
    });

    test("should return unknown for empty/unknown identifiers", () => {
      expect(createAuditIdentifier("")).toBe("unknown");
      expect(createAuditIdentifier("unknown")).toBe("unknown");
      expect(createAuditIdentifier("unknown_user")).toBe("unknown");
    });

    test("should create consistent hashes for same input", () => {
      const email = "test@example.com";
      const id1 = createAuditIdentifier(email, "email");
      const id2 = createAuditIdentifier(email, "email");

      expect(id1).toBe(id2);
    });

    test("should use default prefix when none provided", () => {
      const identifier = createAuditIdentifier("test@example.com");
      expect(identifier).toMatch(/^actor_/);
    });

    test("should handle case-insensitive inputs consistently", () => {
      const id1 = createAuditIdentifier("User@Example.COM", "email");
      const id2 = createAuditIdentifier("user@example.com", "email");

      expect(id1).toBe(id2);
    });

    test("should handle special characters in identifiers", () => {
      const specialEmail = "user+test@example-domain.co.uk";
      const identifier = createAuditIdentifier(specialEmail, "email");

      expect(identifier).toMatch(/^email_/);
      expect(identifier).not.toContain("user+test");
      expect(identifier.length).toBe(38); // "email_" + 32 chars
    });

    test("should create different hashes for different prefixes", () => {
      const input = "test@example.com";
      const emailId = createAuditIdentifier(input, "email");
      const ipId = createAuditIdentifier(input, "ip");

      expect(emailId).not.toBe(ipId);
      expect(emailId).toMatch(/^email_/);
      expect(ipId).toMatch(/^ip_/);
    });

    test("should handle numeric identifiers", () => {
      const numericId = "12345678";
      const identifier = createAuditIdentifier(numericId, "user");

      expect(identifier).toMatch(/^user_/);
      expect(identifier).not.toContain("12345678");
    });
  });

  describe("Rate Limiting", () => {
    test("successful authentications never need Redis", async () => {
      expect(await shouldLogAuthFailure("user@example.com", true)).toBe(true);
      expect(mockCache.getRedisClient).not.toHaveBeenCalled();
    });
    test("Redis outages emit every failure instead of losing the security trail", async () => {
      mockCache.getRedisClient.mockResolvedValue(null);
      for (let attempt = 0; attempt < 10; attempt++)
        expect(await shouldLogAuthFailure("user@example.com")).toBe(true);
    });
    test("uses the atomic sampling decision", async () => {
      const evaluate = vi.fn().mockResolvedValueOnce([1, 3, 0]).mockResolvedValueOnce([0, 4, 1]);
      mockCache.getRedisClient.mockResolvedValue({ eval: evaluate });
      expect(await shouldLogAuthFailure("user@example.com")).toBe(true);
      expect(await shouldLogAuthFailure("user@example.com")).toBe(false);
    });
  });

  describe("Audit Logging Functions", () => {
    test("should log auth event with hashed identifier", () => {
      logAuthEvent("authenticationAttempted", "failure", "unknown", "user@example.com", {
        failureReason: "invalid_password",
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith({
        action: "authenticationAttempted",
        targetType: "user",
        userId: "email_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        targetId: "email_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        organizationId: "global",
        scope: "global",
        source: "native-auth",
        requestId: "test-uuid-123",
        status: "failure",
        userType: "anonymous",
        newObject: {
          failureReason: "invalid_password",
        },
      });
    });

    test("should use provided userId when available", () => {
      logAuthEvent("passwordVerified", "success", "user_123", "user@example.com", {
        requires2FA: true,
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith({
        action: "passwordVerified",
        targetType: "user",
        userId: "user_123",
        targetId: "user_123",
        organizationId: "global",
        scope: "global",
        source: "native-auth",
        requestId: "test-uuid-123",
        status: "success",
        userType: "user",
        newObject: {
          requires2FA: true,
        },
      });
    });

    test("should log authentication attempt with correct structure", () => {
      logAuthAttempt(
        "invalid_password",
        "credentials",
        "password_validation",
        "user_123",
        "user@example.com"
      );

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "authenticationAttempted",
          status: "failure",
          userId: "user_123",
          newObject: expect.objectContaining({
            failureReason: "invalid_password",
            provider: "credentials",
            authMethod: "password_validation",
          }),
        })
      );
    });

    test("should log successful authentication", () => {
      logAuthSuccess(
        "authenticationSucceeded",
        "credentials",
        "password_only",
        "user_123",
        "user@example.com"
      );

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "authenticationSucceeded",
          status: "success",
          userId: "user_123",
          newObject: expect.objectContaining({
            provider: "credentials",
            authMethod: "password_only",
          }),
        })
      );
    });

    test("should log two-factor verification", () => {
      logTwoFactorAttempt(true, "totp", "user_123", "user@example.com");

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "twoFactorVerified",
          status: "success",
          newObject: expect.objectContaining({
            provider: "credentials",
            authMethod: "totp",
          }),
        })
      );
    });

    test("should log failed two-factor attempt", () => {
      logTwoFactorAttempt(false, "backup_code", "user_123", "user@example.com", "invalid_backup_code");

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "twoFactorAttempted",
          status: "failure",
          newObject: expect.objectContaining({
            provider: "credentials",
            authMethod: "backup_code",
            failureReason: "invalid_backup_code",
          }),
        })
      );
    });

    test("should log email verification", () => {
      logEmailVerificationAttempt(true, undefined, "user_123", "user@example.com", {
        emailVerifiedAt: new Date().toISOString(),
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "emailVerified",
          status: "success",
          newObject: expect.objectContaining({
            provider: "token",
            authMethod: "email_verification",
          }),
        })
      );
    });

    test("should log failed email verification", () => {
      logEmailVerificationAttempt(false, "invalid_token", "user_123", "user@example.com", {
        tokenProvided: true,
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith({
        action: "emailVerificationAttempted",
        targetType: "user",
        userId: "user_123",
        userType: "user",
        targetId: "user_123",
        organizationId: "global",
        scope: "global",
        source: "native-auth",
        requestId: "test-uuid-123",
        status: "failure",
        newObject: {
          failureReason: "invalid_token",
          provider: "token",
          authMethod: "email_verification",
          tokenProvided: true,
        },
      });
    });
  });

  describe("PII Protection", () => {
    test("should never log actual email addresses", () => {
      const email = "sensitive@company.com";

      logAuthAttempt("invalid_password", "credentials", "password_validation", "unknown", email);

      const logCall = (queueAuditEventBackground as any).mock.calls[0][0];
      const logString = JSON.stringify(logCall);

      expect(logString).not.toContain("sensitive@company.com");
      expect(logString).not.toContain("company.com");
      expect(logString).not.toContain("sensitive");
    });

    test("should create consistent hashed identifiers", () => {
      const email = "user@example.com";

      logAuthAttempt("invalid_password", "credentials", "password_validation", "unknown", email);
      logAuthAttempt("user_not_found", "credentials", "user_lookup", "unknown", email);

      const calls = (queueAuditEventBackground as any).mock.calls;
      expect(calls[0][0].userId).toBe(calls[1][0].userId);
    });
  });

  describe("Sentry Integration (ENG-2037)", () => {
    test("does NOT capture expected auth failures to Sentry, but still audits them", () => {
      logAuthEvent("authenticationAttempted", "failure", "user_123", "user@example.com", {
        failureReason: "invalid_password",
        provider: "credentials",
        authMethod: "password_validation",
      });

      // Expected auth failures are noise in Sentry — the audit log is the security record.
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({ action: "authenticationAttempted", status: "failure" })
      );
    });

    test("does not capture successful authentication to Sentry", () => {
      vi.clearAllMocks();

      logAuthEvent("passwordVerified", "success", "user_123", "user@example.com", {
        provider: "credentials",
        authMethod: "password_validation",
      });

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
