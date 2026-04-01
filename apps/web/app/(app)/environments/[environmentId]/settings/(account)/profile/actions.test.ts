import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { requestPasswordReset } from "@/modules/auth/forgot-password/lib/password-reset-service";
import { resetPasswordAction } from "./actions";

vi.mock("@/app/(app)/environments/[environmentId]/settings/(account)/profile/lib/user", () => ({
  getIsEmailUnique: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    EMAIL_VERIFICATION_DISABLED: false,
    PASSWORD_RESET_DISABLED: false,
  };
});

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

vi.mock("@/modules/auth/lib/brevo", () => ({
  updateBrevoCustomer: vi.fn(),
}));

vi.mock("@/modules/auth/forgot-password/lib/password-reset-service", () => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendVerificationNewEmail: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    actions: {
      emailUpdate: { interval: 3600, allowedPerInterval: 3, namespace: "action:email" },
    },
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event: string, _object: string, fn: Function) => fn),
}));

describe("profile resetPasswordAction", () => {
  const mockCtx = {
    user: {
      id: "user_123",
      email: "user@example.com",
      locale: "en-US",
      identityProvider: "email",
    },
    auditLoggingCtx: {
      userId: "",
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("delegates to the shared password reset request service", async () => {
    const result = await resetPasswordAction({
      ctx: mockCtx,
    } as any);

    expect(result).toEqual({ success: true });
    expect(requestPasswordReset).toHaveBeenCalledWith(mockCtx.user, "profile");
    expect(mockCtx.auditLoggingCtx.userId).toBe(mockCtx.user.id);
  });

  test("surfaces request failures for authenticated users", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new Error("SMTP failed"));

    await expect(
      resetPasswordAction({
        ctx: mockCtx,
      } as any)
    ).rejects.toThrow("SMTP failed");
  });

  test("rejects password reset for non-email identity providers", async () => {
    await expect(
      resetPasswordAction({
        ctx: {
          ...mockCtx,
          user: {
            ...mockCtx.user,
            identityProvider: "google",
          },
        },
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
