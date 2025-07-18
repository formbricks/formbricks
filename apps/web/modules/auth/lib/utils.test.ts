import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createAuditIdentifier,
  hashPassword,
  logAuthAttempt,
  logAuthEvent,
  logAuthSuccess,
  logEmailVerificationAttempt,
  logSignOut,
  logTwoFactorAttempt,
  shouldLogAuthFailure,
  verifyPassword,
} from "./utils";

// Mock the audit event handler
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(),
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
}));

// Mock Redis client
const { mockGetRedisClient } = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
}));

vi.mock("@/modules/cache/redis", () => ({
  getRedisClient: mockGetRedisClient,
}));

describe("Auth Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });

    test("should verify a correct password", async () => {
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    test("should reject an incorrect password", async () => {
      const isValid = await verifyPassword("WrongPassword123!", hashedPassword);
      expect(isValid).toBe(false);
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
  });

  describe("Rate Limiting", () => {
    test("should always allow successful authentication logging", async () => {
      // This test doesn't need Redis to be available as it short-circuits for success
      mockGetRedisClient.mockResolvedValue(null);

      expect(await shouldLogAuthFailure("user@example.com", true)).toBe(true);
      expect(await shouldLogAuthFailure("user@example.com", true)).toBe(true);
    });

    test("should implement fail-closed behavior when Redis is unavailable", async () => {
      // Set Redis unavailable for this test
      mockGetRedisClient.mockResolvedValue(null);

      const email = "rate-limit-test@example.com";

      // When Redis is unavailable (mocked as null), the system fails closed for security.
      // This prevents authentication failure logging when we cannot enforce rate limiting,
      // ensuring consistent security posture across distributed systems.
      // All authentication failure attempts should return false (do not log).
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 1st failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 2nd failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 3rd failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 4th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 5th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 6th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 7th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 8th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 9th failure - blocked
      expect(await shouldLogAuthFailure(email, false)).toBe(false); // 10th failure - blocked
    });

    describe("Redis Available - All Branch Coverage", () => {
      let mockRedis: any;
      let mockMulti: any;

      beforeEach(() => {
        // Clear mocks first
        vi.clearAllMocks();

        // Create comprehensive Redis mock
        mockMulti = {
          zRemRangeByScore: vi.fn().mockReturnThis(),
          zCard: vi.fn().mockReturnThis(),
          zAdd: vi.fn().mockReturnThis(),
          expire: vi.fn().mockReturnThis(),
          exec: vi.fn(),
        };

        mockRedis = {
          multi: vi.fn().mockReturnValue(mockMulti),
          zRange: vi.fn(),
          isReady: true, // Add isReady property
        };

        // Reset the Redis mock for these specific tests
        mockGetRedisClient.mockReset();
        mockGetRedisClient.mockReturnValue(mockRedis); // Use mockReturnValue instead of mockResolvedValue
      });

      test("should handle Redis transaction failure - !results branch", async () => {
        // Create fresh mock objects for this test
        const testMockMulti = {
          zRemRangeByScore: vi.fn().mockReturnThis(),
          zCard: vi.fn().mockReturnThis(),
          zAdd: vi.fn().mockReturnThis(),
          expire: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue(null), // Mock transaction returning null
        };

        const testMockRedis = {
          multi: vi.fn().mockReturnValue(testMockMulti),
          zRange: vi.fn(),
          isReady: true,
        };

        // Reset and setup mock for this specific test
        mockGetRedisClient.mockReset();
        mockGetRedisClient.mockReturnValue(testMockRedis);

        const email = "transaction-failure@example.com";
        const result = await shouldLogAuthFailure(email, false);

        // Function should return false when Redis transaction fails (fail-closed behavior)
        expect(result).toBe(false);
        expect(mockGetRedisClient).toHaveBeenCalled();
        expect(testMockRedis.multi).toHaveBeenCalled();
        expect(testMockMulti.zRemRangeByScore).toHaveBeenCalled();
        expect(testMockMulti.zCard).toHaveBeenCalled();
        expect(testMockMulti.zAdd).toHaveBeenCalled();
        expect(testMockMulti.expire).toHaveBeenCalled();
        expect(testMockMulti.exec).toHaveBeenCalled();
      });

      test("should allow logging when currentCount <= AGGREGATION_THRESHOLD", async () => {
        // Mock Redis transaction returning count <= threshold (assuming threshold is 3)
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          2, // zCard result - below threshold
          null, // zAdd result
          null, // expire result
        ]);

        const email = "below-threshold@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(true);
        expect(mockMulti.exec).toHaveBeenCalled();
      });

      test("should allow logging when recentEntries.length === 0", async () => {
        // Mock Redis transaction returning count above threshold
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          5, // zCard result - above threshold
          null, // zAdd result
          null, // expire result
        ]);

        // Mock zRange returning empty array
        mockRedis.zRange.mockResolvedValue([]);

        const email = "no-recent-entries@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(true);
        expect(mockRedis.zRange).toHaveBeenCalledWith(expect.stringContaining("rate_limit:auth:"), -10, -1);
      });

      test("should allow logging on every 10th attempt - currentCount % 10 === 0", async () => {
        const now = Date.now();

        // Mock Redis transaction returning count that is divisible by 10
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          10, // zCard result - 10th attempt
          null, // zAdd result
          null, // expire result
        ]);

        // Mock zRange returning recent entries
        mockRedis.zRange.mockResolvedValue([
          `${now - 30000}:uuid1`, // 30 seconds ago
        ]);

        const email = "tenth-attempt@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(true);
        expect(mockRedis.zRange).toHaveBeenCalled();
      });

      test("should allow logging after 1 minute gap - timeSinceLastLog > 60000", async () => {
        const now = Date.now();

        // Mock Redis transaction returning count not divisible by 10
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          7, // zCard result - 7th attempt (not divisible by 10)
          null, // zAdd result
          null, // expire result
        ]);

        // Mock zRange returning entry older than 1 minute
        mockRedis.zRange.mockResolvedValue([
          `${now - 120000}:uuid1`, // 2 minutes ago
        ]);

        const email = "one-minute-gap@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(true);
        expect(mockRedis.zRange).toHaveBeenCalled();
      });

      test("should block logging when neither condition is met", async () => {
        const now = Date.now();

        // Mock Redis transaction returning count not divisible by 10
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          7, // zCard result - 7th attempt (not divisible by 10)
          null, // zAdd result
          null, // expire result
        ]);

        // Mock zRange returning recent entry (less than 1 minute)
        mockRedis.zRange.mockResolvedValue([
          `${now - 30000}:uuid1`, // 30 seconds ago
        ]);

        const email = "blocked-logging@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(false);
        expect(mockRedis.zRange).toHaveBeenCalled();
      });

      test("should handle Redis operation errors gracefully", async () => {
        // Mock Redis multi throwing an error
        mockMulti.exec.mockRejectedValue(new Error("Redis operation failed"));

        const email = "redis-error@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(false);
        expect(mockMulti.exec).toHaveBeenCalled();
      });

      test("should handle zRange errors gracefully", async () => {
        // Mock successful transaction but zRange failing
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          5, // zCard result - above threshold
          null, // zAdd result
          null, // expire result
        ]);

        mockRedis.zRange.mockRejectedValue(new Error("zRange failed"));

        const email = "zrange-error@example.com";
        const result = await shouldLogAuthFailure(email, false);

        expect(result).toBe(false);
        expect(mockRedis.zRange).toHaveBeenCalled();
      });

      test("should handle malformed timestamp in recent entries", async () => {
        // Mock Redis transaction returning count not divisible by 10
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          7, // zCard result - 7th attempt
          null, // zAdd result
          null, // expire result
        ]);

        // Mock zRange returning entry with malformed timestamp
        mockRedis.zRange.mockResolvedValue(["invalid-timestamp:uuid1"]);

        const email = "malformed-timestamp@example.com";
        const result = await shouldLogAuthFailure(email, false);

        // Should handle parseInt(NaN) gracefully and still make a decision
        expect(typeof result).toBe("boolean");
        expect(mockRedis.zRange).toHaveBeenCalled();
      });

      test("should verify correct Redis key generation and operations", async () => {
        mockMulti.exec.mockResolvedValue([
          null, // zRemRangeByScore result
          2, // zCard result - below threshold
          null, // zAdd result
          null, // expire result
        ]);

        const email = "key-generation@example.com";
        await shouldLogAuthFailure(email, false);

        // Verify correct Redis operations were called
        expect(mockRedis.multi).toHaveBeenCalled();
        expect(mockMulti.zRemRangeByScore).toHaveBeenCalledWith(
          expect.stringContaining("rate_limit:auth:"),
          0,
          expect.any(Number)
        );
        expect(mockMulti.zCard).toHaveBeenCalledWith(expect.stringContaining("rate_limit:auth:"));
        expect(mockMulti.zAdd).toHaveBeenCalledWith(
          expect.stringContaining("rate_limit:auth:"),
          expect.objectContaining({
            score: expect.any(Number),
            value: expect.stringMatching(/^\d+:.+$/),
          })
        );
        expect(mockMulti.expire).toHaveBeenCalledWith(
          expect.stringContaining("rate_limit:auth:"),
          expect.any(Number)
        );
      });
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
        organizationId: "unknown",
        status: "failure",
        userType: "user",
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
        organizationId: "unknown",
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
        organizationId: UNKNOWN_DATA,
        status: "failure",
        newObject: {
          failureReason: "invalid_token",
          provider: "token",
          authMethod: "email_verification",
          tokenProvided: true,
        },
      });
    });

    test("should log user sign out event", () => {
      logSignOut("user_123", "user@example.com", {
        reason: "user_initiated",
        redirectUrl: "/auth/login",
        organizationId: "org_123",
      });

      expect(queueAuditEventBackground).toHaveBeenCalledWith({
        action: "userSignedOut",
        targetType: "user",
        userId: "user_123",
        userType: "user",
        targetId: "user_123",
        organizationId: UNKNOWN_DATA,
        status: "success",
        newObject: {
          provider: "session",
          authMethod: "sign_out",
          reason: "user_initiated",
          redirectUrl: "/auth/login",
          organizationId: "org_123",
        },
      });
    });

    test("should log sign out with default reason", () => {
      logSignOut("user_123", "user@example.com");

      expect(queueAuditEventBackground).toHaveBeenCalledWith({
        action: "userSignedOut",
        targetType: "user",
        userId: "user_123",
        userType: "user",
        targetId: "user_123",
        organizationId: UNKNOWN_DATA,
        status: "success",
        newObject: {
          provider: "session",
          authMethod: "sign_out",
          reason: "user_initiated",
          organizationId: undefined,
          redirectUrl: undefined,
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

  describe("Sentry Integration", () => {
    test("should capture authentication failures to Sentry", () => {
      logAuthEvent("authenticationAttempted", "failure", "user_123", "user@example.com", {
        failureReason: "invalid_password",
        provider: "credentials",
        authMethod: "password_validation",
        tags: { security_event: "password_failure" },
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            component: "authentication",
            action: "authenticationAttempted",
            status: "failure",
            security_event: "password_failure",
          }),
          extra: expect.objectContaining({
            userId: "user_123",
            provider: "credentials",
            authMethod: "password_validation",
            failureReason: "invalid_password",
          }),
        })
      );
    });

    test("should not capture successful authentication to Sentry", () => {
      vi.clearAllMocks();

      logAuthEvent("passwordVerified", "success", "user_123", "user@example.com", {
        provider: "credentials",
        authMethod: "password_validation",
      });

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
