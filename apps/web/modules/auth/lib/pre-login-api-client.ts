import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Client fetchers for the pre-login pages reached from an email link. Each throws a `V3ApiError` on a refusal. */

/** Set a new password with the token from a reset email. */
export const completePasswordReset = (body: { token: string; password: string }) =>
  sendApiRequest<void>("/api/internal/password-resets", { method: "POST", body });

/** Confirm a new email address with the token from its confirmation email. */
export const verifyEmailChange = (token: string) =>
  sendApiRequest<void>("/api/internal/email-change-verifications", { method: "POST", body: { token } });
