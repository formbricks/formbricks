"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { requestSsoAccountDeletionEmail } from "@/modules/account/lib/better-auth-account-deletion-request";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

/**
 * SSO account-deletion email-link request (ENG-1054, design doc §14). Credential users delete via
 * Better Auth's native `authClient.deleteUser({ password })` straight from the modal; SSO users have no
 * password, so confirmation moves to the inbox — this action mints the `delete-account-<token>`
 * verification value and emails Better Auth's `GET /api/auth/delete-user/callback` link. The session
 * gate and the mint itself live in `requestSsoAccountDeletionEmail` (server-only, no args); this
 * wrapper only enforces the shared account-deletion rate limit.
 */
export const requestSsoAccountDeletionEmailAction = authenticatedActionClient.action(async ({ ctx }) => {
  await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

  await requestSsoAccountDeletionEmail();

  return { emailSent: true };
});
