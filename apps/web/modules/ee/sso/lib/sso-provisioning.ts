import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO, WEBAPP_URL } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { updateUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";

export type TSsoProvisioningDecision =
  | { action: "reject"; reason: string }
  | {
      action: "provision";
      /** Org to auto-assign the new member to; null = fresh instance / multi-org (no auto-assignment). */
      organizationId: string | null;
      assignToDefaultTeam: boolean;
      signupSource: "invite" | "direct";
    };

/**
 * Gate for SSO just-in-time user provisioning — the orphan-safe, WRITE-FREE decision logic mirrored
 * from `provisionNewSsoUser` (sso-handlers.ts:254-363).
 *
 * MUST be called from `databaseHooks.user.create.before`, which Better Auth runs INSIDE the
 * user+account transaction: a `"reject"` there → return `false` → the row rolls back, so no orphan
 * user is created (design doc §13; the post-commit `user.create.after` could not reject safely). The
 * `"provision"` decision (resolved org + flags) is carried to the after-hook, which performs the
 * membership writes.
 *
 * Parity invariants (pinned by sso-handlers.test.ts): fresh-instance & multi-org bypass all gates;
 * single-org + `SKIP_INVITE_FOR_SSO` requires `DEFAULT_TEAM_ID`; otherwise a valid invite token
 * matching the email is required; the assignment org is the default team's org (skip-invite) or the
 * first org; access control without a callback URL is refused.
 */
export const gateSsoProvisioning = async ({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}): Promise<TSsoProvisioningDecision> => {
  const signupSource = callbackUrl.includes("token=") ? "invite" : "direct";

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const isFirstUser = await getIsFreshInstance();

  // Fresh instance or multi-org: create the user with no org auto-assignment (handled by onboarding
  // / explicit invites elsewhere).
  if (isFirstUser || isMultiOrgEnabled) {
    return { action: "provision", organizationId: null, assignToDefaultTeam: false, signupSource };
  }

  // Single-org, non-fresh — refuse to auto-provision into an arbitrary org without a default team.
  if (SKIP_INVITE_FOR_SSO && !DEFAULT_TEAM_ID) {
    return { action: "reject", reason: "missing_default_team_id" };
  }

  // When not skipping invites, require a valid invite token whose email matches the user's.
  if (!SKIP_INVITE_FOR_SSO) {
    if (!callbackUrl) return { action: "reject", reason: "missing_callback_url" };
    try {
      // Resolve against WEBAPP_URL so a root-relative callback (e.g. `/auth/signup?token=…`) parses
      // instead of throwing — a bare `new URL()` would reject it as invite_token_validation_error.
      const url = new URL(callbackUrl, WEBAPP_URL);
      const inviteToken = url.searchParams.get("token") || "";
      const source = url.searchParams.get("source") || "";
      if (source === "signin" && !inviteToken) {
        return { action: "reject", reason: "signin_without_invite_token" };
      }
      const { email: inviteEmail, inviteId } = verifyInviteToken(inviteToken);
      if (inviteEmail !== email) return { action: "reject", reason: "invite_email_mismatch" };
      if (!(await getIsValidInviteToken(inviteId))) {
        return { action: "reject", reason: "invalid_invite_token" };
      }
    } catch {
      return { action: "reject", reason: "invite_token_validation_error" };
    }
  }

  // Resolve the organization to assign the new member to.
  const organization =
    SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID
      ? await getOrganizationByTeamId(DEFAULT_TEAM_ID)
      : await getFirstOrganization();
  if (!organization) return { action: "reject", reason: "no_organization_found" };

  const isAccessControlAllowed = await getAccessControlPermission(organization.id);
  if (!isAccessControlAllowed && !callbackUrl) {
    return { action: "reject", reason: "insufficient_role_permissions" };
  }

  return {
    action: "provision",
    organizationId: organization.id,
    assignToDefaultTeam: Boolean(SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID),
    signupSource,
  };
};

/**
 * Provisioning WRITES for a newly created SSO user — mirrors provisionNewSsoUser:404-452. Called from
 * `databaseHooks.user.create.after` (post-commit), so it CANNOT share Better Auth's user/account
 * transaction (design doc §13). It runs its own transaction and is idempotent + best-effort:
 * `createMembership`/`createDefaultTeamMembership` upsert, and a failure is retried once then logged
 * (for alerting) rather than thrown — throwing here would not roll back the already-committed user and
 * would surface a confusing mid-sign-in error. Analytics/CRM sync runs regardless (parity).
 */
export const provisionSsoUserMemberships = async ({
  userId,
  email,
  provider,
  organizationId,
  assignToDefaultTeam,
  signupSource,
}: {
  userId: string;
  email: string;
  provider: IdentityProvider;
  organizationId: string | null;
  assignToDefaultTeam: boolean;
  signupSource: "invite" | "direct";
}): Promise<void> => {
  if (organizationId) {
    const MAX_ATTEMPTS = 2;
    let assigned = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !assigned; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          await createMembership(organizationId, userId, { role: "member", accepted: true }, tx);
          if (assignToDefaultTeam) {
            await createDefaultTeamMembership(userId, tx);
          }
          const dbUser = await tx.user.findUnique({
            where: { id: userId },
            select: { notificationSettings: true },
          });
          const current = (dbUser?.notificationSettings ?? {}) as TUserNotificationSettings;
          await updateUser(
            userId,
            {
              notificationSettings: {
                ...current,
                alert: { ...current.alert },
                unsubscribedOrganizationIds: Array.from(
                  new Set([...(current.unsubscribedOrganizationIds ?? []), organizationId])
                ),
              },
            },
            tx
          );
        });
        assigned = true;
      } catch (error) {
        // The user + account are already committed by Better Auth; never throw here (it would not
        // roll them back and would break sign-in). On the final attempt, log an error for alerting:
        // there is no automatic retry on later sign-ins, so a sustained failure needs manual
        // reconciliation (the writes are idempotent, so an operational retry is safe).
        if (attempt === MAX_ATTEMPTS) {
          logger.error(error, "SSO provisioning: failed to assign new SSO user to its organization");
        }
      }
    }
  }

  // Best-effort analytics + CRM sync, regardless of org assignment (parity with provisionNewSsoUser).
  createBrevoCustomer({ id: userId, email });
  capturePostHogEvent(userId, "user_signed_up", {
    auth_provider: provider,
    email_domain: email.split("@")[1],
    signup_source: signupSource,
    invite_organization_id: organizationId,
  });
};
