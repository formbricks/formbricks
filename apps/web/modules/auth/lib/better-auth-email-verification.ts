import "server-only";
import { logger } from "@formbricks/logger";
import { capturePostHogEvent } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { markEmailJustVerified } from "./email-verification-request-context";

/**
 * Better Auth `afterEmailVerification` hook (ENG-1054, Phase 7) — re-homes the NextAuth `"token"`
 * provider's `createBrevoCustomer`-on-first-verification side effect. Better Auth blocks
 * re-verification, so this fires once per user (parity with the old `!user.emailVerified` guard).
 *
 * Fire-and-forget: the CRM call must never block or break verification — matching the NextAuth behavior
 * (which also didn't await it). `createBrevoCustomer` no-ops without `BREVO_API_KEY`.
 */
export const createBrevoCustomerAfterEmailVerification = async (user: {
  id: string;
  email: string;
}): Promise<void> => {
  capturePostHogEvent(user.id, "user_email_confirmed");

  void createBrevoCustomer({ id: user.id, email: user.email }).catch((err) =>
    logger.error(err, "Failed to create Brevo customer after email verification")
  );
};

/**
 * The composed `afterEmailVerification` hook.
 *
 * Ordering is load-bearing: the ENG-2562 marker is recorded FIRST, so that a fault in the CRM/analytics
 * side effect cannot cost a legitimate sign-up its session. `markEmailJustVerified` is a synchronous
 * store write with no I/O, which is what makes putting it first safe rather than merely convenient.
 *
 * The CRM half is additionally wrapped: it is fire-and-forget by design, and Better Auth awaits this
 * hook inside the verification request, so letting a throw escape here would 500 a request that has
 * already flipped `emailVerified` — leaving the user verified, unsigned-in, and with no way back but
 * the login page. Same reasoning as the auto-sign-in after-handler.
 */
export const runAfterEmailVerificationHooks = async (user: { id: string; email: string }): Promise<void> => {
  markEmailJustVerified(user.id);

  try {
    await createBrevoCustomerAfterEmailVerification(user);
  } catch (error) {
    logger.error({ error, userId: user.id }, "afterEmailVerification side effect failed");
  }
};
