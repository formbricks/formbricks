import "server-only";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { logger } from "@formbricks/logger";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
} from "@formbricks/types/errors";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { auth } from "@/modules/auth/lib/auth";
import { isPasswordCompromisedError } from "@/modules/auth/lib/better-auth-hibp";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TPasswordResetBody } from "../schemas";

type TRequestContext = { requestId: string; instance?: string };

/** A refusal the reset form explains: `details.reason` is the stable code it translates. */
const refused = ({ requestId, instance }: TRequestContext, reason: string, detail: string) =>
  problemUnprocessableContent(requestId, detail, { instance, details: { reason } });

/**
 * `POST /api/internal/password-resets`: set a new password with a reset token. Pre-login, so charged to the
 * client's IP. Session revocation, the security notification email and the audit event happen inside
 * Better Auth (`revokeSessionsOnPasswordReset`, `onPasswordReset` in `auth.ts`).
 */
export async function completePasswordResetOperation({
  body,
  ...context
}: TRequestContext & { body: TPasswordResetBody }): Promise<Response> {
  const { requestId, instance } = context;
  if (PASSWORD_RESET_DISABLED) return problemForbidden(requestId, "Password reset is disabled", instance);

  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.resetPassword, context);
  if (limited) return limited;

  try {
    await auth.api.resetPassword({
      body: { token: body.token, newPassword: body.password },
      headers: await headers(),
    });
  } catch (error) {
    // The HIBP plugin rejects a breached password with its own APIError; this MUST precede the catch-all
    // below, which would otherwise call it an invalid or expired link.
    if (isPasswordCompromisedError(error)) {
      return refused(
        context,
        PASSWORD_COMPROMISED_ERROR_CODE,
        "This password has appeared in a data breach."
      );
    }
    // An invalid, expired or already-used token.
    if (isAPIError(error)) {
      return refused(
        context,
        INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
        "The reset link is invalid or has expired."
      );
    }
    // ENG-3258: Better Auth could not see the user's credential row and tried to create a second one. The
    // token is spent by then, so this is an invalid link, not a server error. Logged because the sign-in /
    // reset-request heal should have made it impossible.
    if (isUniqueConstraintError(error)) {
      logger.error({ error }, "Password reset collided with an existing credential account");
      return refused(
        context,
        INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
        "The reset link is invalid or has expired."
      );
    }
    throw error;
  }

  return noContentResponse({ requestId });
}
