import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  InvalidInputError,
  InvalidPasswordResetTokenError,
  OperationNotAllowedError,
  PASSWORD_COMPROMISED_ERROR_CODE,
} from "@formbricks/types/errors";
import { auth } from "@/modules/auth/lib/auth";
import { resetPasswordAction } from "./actions";

const constantsState = vi.hoisted(() => ({
  passwordResetDisabled: false,
}));

// Reset now goes through Better Auth; the post-reset audit/notification/session-revocation live in
// auth.ts (onPasswordReset + revokeSessionsOnPasswordReset), not this action (ENG-1054).
vi.mock("@/modules/auth/lib/auth", () => ({
  auth: { api: { resetPassword: vi.fn() } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock("@/lib/constants", () => ({
  get PASSWORD_RESET_DISABLED() {
    return constantsState.passwordResetDisabled;
  },
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("resetPasswordAction", () => {
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

  test("resets the password through Better Auth on success", async () => {
    vi.mocked(auth.api.resetPassword).mockResolvedValue({ status: true } as any);

    const result = await resetPasswordAction({ parsedInput } as any);

    expect(result).toEqual({ success: true });
    expect(auth.api.resetPassword).toHaveBeenCalledWith({
      body: { token: parsedInput.token, newPassword: parsedInput.password },
      headers: expect.any(Headers),
    });
  });

  test("maps a Better Auth APIError (invalid/expired/used token) to the invalid-reset-token error", async () => {
    vi.mocked(auth.api.resetPassword).mockRejectedValue(
      new APIError("BAD_REQUEST", { message: "invalid token", code: "INVALID_TOKEN" })
    );

    // Invoke once and assert on the single promise — this action wraps a mutating auth call, so
    // re-invoking would double the side effect and weaken the test.
    const result = resetPasswordAction({ parsedInput } as any);
    await expect(result).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
    await expect(result).rejects.toThrow(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE);
    expect(auth.api.resetPassword).toHaveBeenCalledTimes(1);
  });

  test("maps a compromised-password APIError to the compromised code, not the invalid-token error", async () => {
    // The HIBP plugin rejects a breached password with its own APIError. This must be surfaced as the
    // stable compromised code — NOT swallowed by the catch-all that maps every APIError to a bogus
    // "invalid/expired token" message.
    vi.mocked(auth.api.resetPassword).mockRejectedValue(
      new APIError("BAD_REQUEST", { message: "breached", code: PASSWORD_COMPROMISED_ERROR_CODE })
    );

    const result = resetPasswordAction({ parsedInput } as any);
    await expect(result).rejects.toBeInstanceOf(InvalidInputError);
    await expect(result).rejects.toThrow(PASSWORD_COMPROMISED_ERROR_CODE);
    expect(auth.api.resetPassword).toHaveBeenCalledTimes(1);
  });

  test("propagates an unexpected (non-APIError) error unchanged", async () => {
    vi.mocked(auth.api.resetPassword).mockRejectedValue(new Error("Database error"));

    await expect(resetPasswordAction({ parsedInput } as any)).rejects.toThrow("Database error");
  });

  test("rejects when password reset is disabled and never calls Better Auth", async () => {
    constantsState.passwordResetDisabled = true;

    await expect(resetPasswordAction({ parsedInput } as any)).rejects.toThrow(OperationNotAllowedError);
    expect(auth.api.resetPassword).not.toHaveBeenCalled();
  });
});
