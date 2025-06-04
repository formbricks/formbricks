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
vi.mock("@/lib/redis", () => ({
  default: null, // Simulate Redis not available for tests (uses in-memory fallback)
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
      expect(await shouldLogAuthFailure("user@example.com", true)).toBe(true);
      expect(await shouldLogAuthFailure("user@example.com", true)).toBe(true);
    });

    test("should allow all failures when Redis is not available", async () => {
      const email = "rate-limit-test@example.com";

      // Since Redis is mocked as null, should allow all logging (fail open)
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 1
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 2
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 3
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 4
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 5
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 6
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 7
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 8
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 9
      expect(await shouldLogAuthFailure(email, false)).toBe(true); // 10
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
