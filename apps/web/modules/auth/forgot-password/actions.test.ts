import { getUserByEmail } from "@/modules/auth/lib/user";
// Import mocked functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { sendForgotPasswordEmail } from "@/modules/email";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { forgotPasswordAction } from "./actions";

// Mock dependencies
vi.mock("@/lib/constants", () => ({
  PASSWORD_RESET_DISABLED: false,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    auth: {
      forgotPassword: { interval: 3600, allowedPerInterval: 5, namespace: "auth:forgot" },
    },
  },
}));

vi.mock("@/modules/auth/lib/user", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendForgotPasswordEmail: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("forgotPasswordAction", () => {
  const validInput = {
    email: "test@example.com",
  };

  const mockUser = {
    id: "user123",
    email: "test@example.com",
    identityProvider: "email",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting", () => {
    test("should apply rate limiting before processing forgot password request", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.forgotPassword);
      expect(applyIPRateLimit).toHaveBeenCalledBefore(getUserByEmail as any);
    });

    test("should throw rate limit error when limit exceeded", async () => {
      vi.mocked(applyIPRateLimit).mockRejectedValue(
        new Error("Maximum number of requests reached. Please try again later.")
      );

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );

      expect(getUserByEmail).not.toHaveBeenCalled();
      expect(sendForgotPasswordEmail).not.toHaveBeenCalled();
    });

    test("should use correct rate limit configuration", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith({
        interval: 3600,
        allowedPerInterval: 5,
        namespace: "auth:forgot",
      });
    });

    test("should apply rate limiting even when user doesn't exist", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.forgotPassword);
      expect(result).toEqual({ success: true });
    });
  });

  describe("Password Reset Flow", () => {
    test("should send password reset email when user exists with email identity provider", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendForgotPasswordEmail).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ success: true });
    });

    test("should not send email when user doesn't exist", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendForgotPasswordEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test("should not send email when user has non-email identity provider", async () => {
      const ssoUser = { ...mockUser, identityProvider: "google" };
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(ssoUser as any);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(sendForgotPasswordEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe("Password Reset Disabled", () => {
    test("should check password reset is enabled in our implementation", async () => {
      // This test verifies that password reset is enabled by default
      // The actual PASSWORD_RESET_DISABLED check is part of the implementation
      // and we've mocked it as false, so rate limiting should work normally
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe("Error Handling", () => {
    test("should propagate rate limiting errors", async () => {
      const rateLimitError = new Error("Maximum number of requests reached. Please try again later.");
      vi.mocked(applyIPRateLimit).mockRejectedValue(rateLimitError);

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );
    });

    test("should handle user lookup errors after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockRejectedValue(new Error("Database error"));

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Database error"
      );

      expect(applyIPRateLimit).toHaveBeenCalled();
    });

    test("should handle email sending errors after rate limiting", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(sendForgotPasswordEmail).mockRejectedValue(new Error("Email service error"));

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Email service error"
      );

      expect(applyIPRateLimit).toHaveBeenCalled();
      expect(getUserByEmail).toHaveBeenCalled();
    });
  });

  describe("Security Considerations", () => {
    test("should always return success even for non-existent users to prevent email enumeration", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(result).toEqual({ success: true });
    });

    test("should always return success even for SSO users to prevent identity provider enumeration", async () => {
      const ssoUser = { ...mockUser, identityProvider: "github" };
      vi.mocked(applyIPRateLimit).mockResolvedValue();
      vi.mocked(getUserByEmail).mockResolvedValue(ssoUser as any);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(result).toEqual({ success: true });
      expect(sendForgotPasswordEmail).not.toHaveBeenCalled();
    });

    test("should rate limit all requests regardless of user existence", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue();

      // Test with existing user
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);
      await forgotPasswordAction({ parsedInput: validInput } as any);

      // Test with non-existing user
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      await forgotPasswordAction({ parsedInput: { email: "nonexistent@example.com" } } as any);

      expect(applyIPRateLimit).toHaveBeenCalledTimes(2);
    });
  });
});
