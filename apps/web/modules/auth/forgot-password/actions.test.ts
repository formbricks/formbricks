import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
// Import mocked functions
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { forgotPasswordAction } from "./actions";

const mocks = vi.hoisted(() => ({
  hasCredentialAccount: vi.fn(),
  // Held in a box and exposed through a getter below so a single test can flip it: `EMAIL_AUTH_ENABLED` is
  // a const import in the action, and the getter keeps the live binding readable per call.
  emailAuthEnabled: { value: true },
}));

const allowedRateLimitResponse = { allowed: true };
const RESET_REDIRECT = "http://localhost:3000/auth/forgot-password/reset";

vi.mock("@/lib/constants", () => ({
  get EMAIL_AUTH_ENABLED() {
    return mocks.emailAuthEnabled.value;
  },
  PASSWORD_RESET_DISABLED: false,
  WEBAPP_URL: "http://localhost:3000",
}));

// Mocked at the module boundary rather than letting the real one load: `lib/user/password` pulls in
// `lib/crypto`, which reads ENCRYPTION_KEY from the (fully replaced) constants mock at import time.
vi.mock("@/lib/user/password", () => ({
  hasCredentialAccount: mocks.hasCredentialAccount,
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

// Password reset requests now go through Better Auth's native endpoint (ENG-1054).
vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { requestPasswordReset: vi.fn() } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("forgotPasswordAction", () => {
  const validInput = { email: "test@example.com" };
  const mockUser = { id: "user123", email: "test@example.com", identityProvider: "email" };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.emailAuthEnabled.value = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting", () => {
    test("applies rate limiting (with the right config) before looking up the user", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.forgotPassword);
      expect(applyIPRateLimit).toHaveBeenCalledBefore(getUserByEmail as any);
    });

    test("throws and short-circuits when the rate limit is exceeded", async () => {
      vi.mocked(applyIPRateLimit).mockRejectedValue(
        new Error("Maximum number of requests reached. Please try again later.")
      );

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Maximum number of requests reached. Please try again later."
      );

      expect(getUserByEmail).not.toHaveBeenCalled();
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("Password Reset Flow", () => {
    test("requests a Better Auth password reset for an email-identity user", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(getUserByEmail).toHaveBeenCalledWith(validInput.email);
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: { email: mockUser.email, redirectTo: RESET_REDIRECT },
        headers: expect.any(Headers),
      });
      expect(result).toEqual({ success: true });
    });

    test("does not request a reset when the user doesn't exist", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test("does not request a reset for an SSO user with no credential account", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue({ ...mockUser, identityProvider: "google" } as any);
      mocks.hasCredentialAccount.mockResolvedValue(false);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  /**
   * SSO recovery is one-way: it flips `identityProvider` to the SSO provider and nothing flips it back,
   * while clearing the password it found. Gated on `identityProvider` alone these users could never ask
   * for a reset again, so the surviving credential `Account` row is what lets them back in (ENG-2557).
   */
  describe("Recovered SSO users (ENG-2557)", () => {
    beforeEach(() => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
    });

    test("requests a reset for an SSO-identity user who still has a credential account", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue({ ...mockUser, identityProvider: "google" } as any);
      mocks.hasCredentialAccount.mockResolvedValue(true);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(mocks.hasCredentialAccount).toHaveBeenCalledWith(mockUser.id);
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: { email: mockUser.email, redirectTo: RESET_REDIRECT },
        headers: expect.any(Headers),
      });
      expect(result).toEqual({ success: true });
    });

    test("stays shut on an SSO-only instance, even with a credential account present", async () => {
      mocks.emailAuthEnabled.value = false;
      vi.mocked(getUserByEmail).mockResolvedValue({ ...mockUser, identityProvider: "google" } as any);
      mocks.hasCredentialAccount.mockResolvedValue(true);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      // Handing a password back where the operator disabled credential auth would be the "sign in around
      // the IdP" bypass that switching it off exists to prevent.
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test("does not need the credential lookup for an email-identity user", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);

      await forgotPasswordAction({ parsedInput: validInput } as any);

      // Short-circuits on `identityProvider === "email"`, so the extra query never runs for the common case.
      expect(mocks.hasCredentialAccount).not.toHaveBeenCalled();
      expect(auth.api.requestPasswordReset).toHaveBeenCalledOnce();
    });
  });

  describe("Error Handling", () => {
    test("swallows a Better Auth request error and still returns success (enumeration-safe)", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(new Error("BA request failed"));

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).resolves.toEqual({
        success: true,
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUser.id }),
        "Password reset request failed"
      );
    });

    test("propagates a user-lookup error", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockRejectedValue(new Error("Database error"));

      await expect(forgotPasswordAction({ parsedInput: validInput } as any)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("Security Considerations (enumeration-safe)", () => {
    test("always returns success for a non-existent user", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      expect(await forgotPasswordAction({ parsedInput: validInput } as any)).toEqual({ success: true });
    });

    test("always returns success for an SSO user and never requests a reset", async () => {
      vi.mocked(applyIPRateLimit).mockResolvedValue(allowedRateLimitResponse);
      vi.mocked(getUserByEmail).mockResolvedValue({ ...mockUser, identityProvider: "github" } as any);
      mocks.hasCredentialAccount.mockResolvedValue(false);

      const result = await forgotPasswordAction({ parsedInput: validInput } as any);

      expect(result).toEqual({ success: true });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });
  });
});
