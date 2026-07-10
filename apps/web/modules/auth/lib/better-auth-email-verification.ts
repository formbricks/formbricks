import "server-only";
import { logger } from "@formbricks/logger";
import { capturePostHogEvent } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";

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
  capturePostHogEvent(user.id, "user_email_confirmed", { email: user.email });

  void createBrevoCustomer({ id: user.id, email: user.email }).catch((err) =>
    logger.error(err, "Failed to create Brevo customer after email verification")
  );
};
