import { APIError } from "better-auth/api";

/**
 * Before-hook gate that rejects password-reset requests when the operator has disabled password resets
 * via PASSWORD_RESET_DISABLED=1. This closes the bypass where the native Better Auth HTTP endpoints
 * (/api/auth/request-password-reset and /api/auth/reset-password) were reachable even though the
 * wrapper server actions (forgotPasswordAction, resetPasswordAction) correctly blocked.
 *
 * ENG-2105.
 */
export const requirePasswordResetEnabledBeforeHandler = async (
  ctx: { path: string },
  passwordResetDisabled: boolean
): Promise<void> => {
  if (!passwordResetDisabled) return;

  if (ctx.path === "/request-password-reset" || ctx.path === "/reset-password") {
    throw new APIError("FORBIDDEN", {
      message: "Password reset is disabled",
    });
  }
};
