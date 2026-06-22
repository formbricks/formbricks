import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE } from "@/modules/account/constants";
import { deleteBrevoCustomerByEmail } from "@/modules/auth/lib/brevo";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { queueAccountDeletionAuditEvent } from "./account-deletion-audit";

type DeleteUserConfig = NonNullable<NonNullable<BetterAuthOptions["user"]>["deleteUser"]>;

/**
 * Better Auth `user.deleteUser` config (ENG-1054, design doc §14) — re-expresses Formbricks' account
 * deletion on Better Auth's native flow, replacing the prior bespoke SSO IdP re-authentication.
 *
 * The confirmation friction is asymmetric and lives at the edges (Phase 6, not here): credential users
 * confirm with their password (Better Auth verifies it before `beforeDelete`); SSO users confirm via an
 * email link (a server action mints a `delete-account-<token>` verification value that Better Auth's
 * native `GET /delete-user/callback` consumes). The global `sendDeleteAccountVerification` is
 * intentionally NOT set in auth.ts — it would email credential users too.
 *
 * The hooks below run for BOTH paths and only get `(user, request)`, so everything is derived from
 * `user.id` / `user.email`. The DeleteAccountModal drives this flow (credential users call
 * `authClient.deleteUser`; SSO users go through the email-link request action). Note the `[...all]`
 * route is not mounted on this client-cutover branch, so the endpoint is reachable only once the
 * coordinated flip lands the server route.
 */

/**
 * Pre-delete steps that do NOT cascade from the `User` row — mirrors `lib/user/service.ts deleteUser`
 * plus the single-org guard the prior account-deletion path enforced:
 *  - Block deletion on single-org instances when the user is the sole owner of any organization
 *    (it would be orphaned) — they must transfer ownership first.
 *  - Otherwise delete the organizations they solely own (only reachable in the multi-org case) and
 *    the invites they created.
 * The user, sessions, accounts, and memberships are removed by Better Auth's deleteUser + the same
 * Prisma cascade `deleteUserById` relies on, so they need no explicit handling here.
 */
export const accountDeletionBeforeDelete: NonNullable<DeleteUserConfig["beforeDelete"]> = async (user) => {
  const soleOwnerOrganizations = await getOrganizationsWhereUserIsSingleOwner(user.id);

  if (soleOwnerOrganizations.length > 0 && !(await getIsMultiOrgEnabled())) {
    // Failure-path audit parity: record the blocked deletion attempt before surfacing the error
    // (the afterDelete success audit never runs for a blocked deletion).
    await queueAccountDeletionAuditEvent({
      status: "failure",
      targetUserId: user.id,
      oldUser: user as Record<string, unknown>,
    });
    throw new APIError("BAD_REQUEST", {
      message: ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE,
    });
  }

  for (const organization of soleOwnerOrganizations) {
    await deleteOrganization(organization.id);
  }
  await prisma.invite.deleteMany({ where: { creatorId: user.id } });
};

/**
 * Post-delete cleanup (the user row is already gone) — mirrors the tail of the deleteUser service and
 * the prior success audit: remove the Brevo contact and emit the account-deletion audit event. A Brevo
 * failure is logged, not thrown: the deletion has already committed, so surfacing an error for a
 * completed delete would be misleading.
 */
export const accountDeletionAfterDelete: NonNullable<DeleteUserConfig["afterDelete"]> = async (user) => {
  try {
    await deleteBrevoCustomerByEmail({ email: user.email });
  } catch (error) {
    logger.error({ error, userId: user.id }, "Failed to delete Brevo customer after account deletion");
  }

  await queueAccountDeletionAuditEvent({
    oldUser: user as Record<string, unknown>,
    status: "success",
    targetUserId: user.id,
  });

  // Analytics parity with the prior account-deletion success path (fire-and-forget; self-swallowing).
  capturePostHogEvent(user.id, "delete_account");
};

export const accountDeletionConfig = {
  enabled: true,
  beforeDelete: accountDeletionBeforeDelete,
  afterDelete: accountDeletionAfterDelete,
} satisfies DeleteUserConfig;
