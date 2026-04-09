import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  InvalidPasswordResetTokenError,
  OperationNotAllowedError,
} from "@formbricks/types/errors";
import { completePasswordReset } from "@/modules/auth/forgot-password/lib/password-reset-service";
import { resetPasswordAction } from "./actions";

const constantsState = vi.hoisted(() => ({
  passwordResetDisabled: false,
}));

vi.mock("@/modules/auth/forgot-password/lib/password-reset-service", () => ({
  completePasswordReset: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  get PASSWORD_RESET_DISABLED() {
    return constantsState.passwordResetDisabled;
  },
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
    constantsState.passwordResetDisabled = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(mockCtx.auditLoggingCtx.oldObject).toEqual({ ...oldUser, passwordResetMarker: false });
    expect(mockCtx.auditLoggingCtx.newObject).toEqual({ ...updatedUser, passwordResetMarker: true });
  });

  test("propagates generic invalid password reset failures", async () => {
    vi.mocked(completePasswordReset).mockRejectedValue(
      new InvalidPasswordResetTokenError(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE, "expired")
    );

    await expect(
      resetPasswordAction({
        ctx: mockCtx,
        parsedInput,
      } as any)
    ).rejects.toThrow(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE);
  });

  test("rejects reset attempts when password reset is disabled", async () => {
    constantsState.passwordResetDisabled = true;

    await expect(
      resetPasswordAction({
        ctx: mockCtx,
        parsedInput,
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);
    expect(completePasswordReset).not.toHaveBeenCalled();
  });
});
