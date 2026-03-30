import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidPasswordResetTokenError } from "@formbricks/types/errors";
import { completePasswordReset } from "@/modules/auth/forgot-password/lib/password-reset-service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { resetPasswordAction } from "./actions";

vi.mock("@/modules/auth/forgot-password/lib/password-reset-service", () => ({
  completePasswordReset: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event: string, _object: string, fn: Function) => fn),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("resetPasswordAction", () => {
  const mockCtx = {
    auditLoggingCtx: {
      userId: "",
      oldObject: null,
      newObject: null,
    },
  };

  const parsedInput = {
    token: "opaque-reset-token",
    password: "Password123",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("is wrapped with audit logging", () => {
    expect(withAuditLogging).toBeDefined();
  });

  test("delegates to completePasswordReset and populates audit context on success", async () => {
    const oldUser = {
      id: "user_123",
      email: "user@example.com",
      locale: "en-US",
      emailVerified: null,
    };
    const updatedUser = {
      ...oldUser,
      emailVerified: new Date(),
    };

    vi.mocked(completePasswordReset).mockResolvedValue({
      userId: "user_123",
      oldUser,
      updatedUser,
    });

    const result = await resetPasswordAction({
      ctx: mockCtx,
      parsedInput,
    } as any);

    expect(result).toEqual({ success: true });
    expect(completePasswordReset).toHaveBeenCalledWith(parsedInput.token, parsedInput.password);
    expect(mockCtx.auditLoggingCtx.userId).toBe("user_123");
    expect(mockCtx.auditLoggingCtx.oldObject).toEqual(oldUser);
    expect(mockCtx.auditLoggingCtx.newObject).toEqual(updatedUser);
  });

  test("propagates generic invalid password reset failures", async () => {
    vi.mocked(completePasswordReset).mockRejectedValue(
      new InvalidPasswordResetTokenError("Invalid or expired password reset link.", "expired")
    );

    await expect(
      resetPasswordAction({
        ctx: mockCtx,
        parsedInput,
      } as any)
    ).rejects.toThrow("Invalid or expired password reset link.");
  });
});
