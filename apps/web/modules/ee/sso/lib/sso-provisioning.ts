import "server-only";
import { DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";

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
      const url = new URL(callbackUrl);
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
