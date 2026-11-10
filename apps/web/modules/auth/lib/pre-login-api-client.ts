import type { TUserLocale } from "@formbricks/types/user";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * Client fetchers for the pre-login pages: sign-up, and the pages reached from an email link. Each throws
 * a `V3ApiError` on a refusal. Same-origin `fetch`es from the app, which the routes' cross-origin check
 * requires.
 */

/** What the sign-up form sends. */
export type TSignupRequest = {
  name: string;
  email: string;
  password: string;
  userLocale?: TUserLocale;
  inviteToken?: string;
  turnstileToken?: string;
  subscribeToSecurityUpdates?: boolean;
  subscribeToProductUpdates?: boolean;
};

/**
 * Create a credential account. The answer is the same whether or not the address already had one, and
 * carries `emailToken`, the display token the "check your inbox" screen reads the address from. No
 * timeout: it checks the password against a breach corpus and sends the verification email.
 */
export const createSignup = (body: TSignupRequest) =>
  sendApiRequest<{ success: true; emailToken: string }>("/api/internal/signups", {
    method: "POST",
    body,
    timeoutMs: null,
  });

/** Set a new password with the token from a reset email. */
export const completePasswordReset = (body: { token: string; password: string }) =>
  sendApiRequest<void>("/api/internal/password-resets", { method: "POST", body });

/** Confirm a new email address with the token from its confirmation email. */
export const verifyEmailChange = (token: string) =>
  sendApiRequest<void>("/api/internal/email-change-verifications", { method: "POST", body: { token } });
