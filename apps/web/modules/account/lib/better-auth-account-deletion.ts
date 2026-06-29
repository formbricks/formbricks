import "server-only";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
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

/**
 * Closes Better Auth's native delete-user freshness shortcut (ENG-1054).
 *
 * `POST /delete-user` verifies the password only when `body.password` is present; with no password it
 * falls back to a session-freshness check (`freshAge` = 1 day in auth.ts), so an empty-body request
 * from a still-fresh session would delete the account with NO confirmation — bypassing the intended
 * friction (password for credential users, email-link callback for SSO). `beforeDelete` only receives
 * `(user, request)` and can't tell whether a password was supplied, so the guard has to sit in the
 * request pipeline.
 *
 * This `before` hook rejects the direct `POST /delete-user` unless a password is supplied. Credential
 * users pass their password (Better Auth then verifies it); SSO users have none and are therefore
 * forced onto the `GET /delete-user/callback?token=...` email-link flow, which this does NOT match.
 * The `freshAge` gate stays in place as defense-in-depth. Shipped as a plugin so it composes with the
 * top-level `hooks.before` (the SSO license gate) instead of clobbering it.
 */
export const accountDeletionGuardPlugin = {
  id: "formbricks-account-deletion-guard",
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/delete-user",
        handler: createAuthMiddleware(async (ctx) => {
          const password = (ctx.body as { password?: unknown } | undefined)?.password;
          if (typeof password !== "string" || password.length === 0) {
            throw new APIError("BAD_REQUEST", {
              message: "Account deletion requires password confirmation.",
            });
          }
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;
