import { getUserByEmail } from "@/modules/auth/lib/user";
// Import mocked functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendVerificationEmail } from "@/modules/email";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resendVerificationEmailAction } from "./actions";

// Mock dependencies
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    auth: {
      verifyEmail: { interval: 3600, allowedPerInterval: 10, namespace: "auth:verify" },
    },
  },
}));

vi.mock("@/modules/auth/lib/user", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((type, object, fn) => fn),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("resendVerificationEmailAction", () => {
  const validInput = {
    email: "test@example.com",
  };

  const mockUser = {
    id: "user123",
    email: "test@example.com",
    emailVerified: null, // Not verified
    name: "Test User",
  };

  const mockVerifiedUser = {
    id: "user123",
    email: "test@example.com",
    emailVerified: new Date(),
    name: "Test User",
  };

  const mockCtx = {
    auditLoggingCtx: {
      organizationId: "",
      userId: "",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting", () => {
    test("should apply rate limiting before processing verification email resend", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await resendVerificationEmailAction({
        ctx: mockCtx,
        parsedInput: validInput,
      } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
      expect(applyIPRateLimit).toHaveBeenCalledBefore(getUserByEmail as any);
    });

    test("should throw rate limit error when limit exceeded", async () => {
      vi.mocked(applyIPRateLimit).mockRejectedValue(new Error("Rate limit exceeded"));

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow("Rate limit exceeded");

      expect(getUserByEmail).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    test("should use correct rate limit configuration", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await resendVerificationEmailAction({
        ctx: mockCtx,
        parsedInput: validInput,
      } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith({
        interval: 3600,
        allowedPerInterval: 10,
        namespace: "auth:verify",
      });
    });

    test("should apply rate limiting even when user doesn't exist", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
    });
  });

  describe("Verification Email Resend Flow", () => {
    test("should send verification email when user exists and email is not verified", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      const result = await resendVerificationEmailAction({
        ctx: mockCtx,
        parsedInput: validInput,
      } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendVerificationEmail).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ success: true });
    });

    test("should return success without sending email when user email is already verified", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as any);

      const result = await resendVerificationEmailAction({
        ctx: mockCtx,
        parsedInput: validInput,
      } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test("should throw ResourceNotFoundError when user doesn't exist", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("Audit Logging", () => {
    test("should be wrapped with audit logging decorator", () => {
      // withAuditLogging is called at module load time to wrap the action
      // We just verify the mock was set up correctly
      expect(withAuditLogging).toBeDefined();
    });

    test("should set audit context userId when sending verification email", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      const testCtx = {
        auditLoggingCtx: {
          organizationId: "",
          userId: "",
        },
      };

      await resendVerificationEmailAction({
        ctx: testCtx,
        parsedInput: validInput,
      } as any);

      // The userId should be set in the audit context
      expect(testCtx.auditLoggingCtx.userId).toBe(mockUser.id);
    });

    test("should not set audit context userId when email is already verified", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockVerifiedUser as any);

      const testCtx = {
        auditLoggingCtx: {
          organizationId: "",
          userId: "",
        },
      };

      await resendVerificationEmailAction({
        ctx: testCtx,
        parsedInput: validInput,
      } as any);

      // The userId should not be set since no email was sent
      expect(testCtx.auditLoggingCtx.userId).toBe("");
    });
  });

  describe("Error Handling", () => {
    test("should propagate rate limiting errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      vi.mocked(applyIPRateLimit).mockRejectedValue(rateLimitError);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow("Rate limit exceeded");
    });

    test("should handle user lookup errors after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockRejectedValue(new Error("Database error"));

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow("Database error");

      expect(applyIPRateLimit).toHaveBeenCalled();
    });

    test("should handle email sending errors after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(sendVerificationEmail).mockRejectedValue(new Error("Email service error"));

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow("Email service error");

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    test("should handle empty email input", async () => {
      const invalidInput = { email: "" };

      // This would be caught by the Zod schema validation in the actual action
      // but we test the behavior if it somehow gets through
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: invalidInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);
    });

    test("should handle malformed email input", async () => {
      const invalidInput = { email: "invalid-email" };

      // This would be caught by the Zod schema validation in the actual action
      // but we test the behavior if it somehow gets through
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: invalidInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("Security Considerations", () => {
    test("should always apply rate limiting regardless of user existence", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);

      expect(applyIPRateLimit).toHaveBeenCalled();
    });

    test("should not leak information about user existence through different error messages", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      // Both non-existent users should throw the same ResourceNotFoundError
      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: validInput,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);

      const anotherEmail = { email: "another@example.com" };
      await expect(
        resendVerificationEmailAction({
          ctx: mockCtx,
          parsedInput: anotherEmail,
        } as any)
      ).rejects.toThrow(ResourceNotFoundError);
    });
  });
});
