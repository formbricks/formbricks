import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO, WEBAPP_URL } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent, identifyPostHogPerson } from "@/lib/posthog";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { updateUser } from "@/modules/auth/lib/user";
import { resolveInviteMatch } from "@/modules/auth/signup/lib/invite";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  type TDefaultOrganizationAssignment,
  ensureDefaultOrganization,
} from "@/modules/ee/sso/lib/default-organization";
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
      /**
       * `DEFAULT_ORGANIZATION_ID` path: `organizationId` names an org that may not exist yet, so the
       * write phase find-or-creates it and derives the membership role from that outcome. Absent on
       * every other path, where the org was read here and the role is always `member`.
       */
      useDefaultOrganization?: boolean;
    };

/**
 * Validates the invite token carried on an SSO callback URL (only consulted when invites aren't
 * skipped). Returns a rejection reason, or null when the invite is valid. Extracted from
 * gateSsoProvisioning so that gate stays under the cognitive-complexity budget — its behavior is
 * covered by sso-provisioning.test.ts.
 */
const validateSsoInviteToken = async (email: string, callbackUrl: string): Promise<string | null> => {
  if (!callbackUrl) return "missing_callback_url";
  let inviteToken = "";
  try {
    // Resolve against WEBAPP_URL so a root-relative callback (e.g. `/auth/signup?token=…`) parses
    // instead of throwing — a bare `new URL()` would reject it.
    const url = new URL(callbackUrl, WEBAPP_URL);
    inviteToken = url.searchParams.get("token") || "";
    const source = url.searchParams.get("source") || "";
    if (source === "signin" && !inviteToken) return "signin_without_invite_token";
  } catch {
    return "invite_token_validation_error";
  }
  // Delegate the token → email-match → validity trio to the shared, case-insensitive helper (the
  // credentials gate uses the same one), mapping its outcome to this gate's granular reject reasons.
  switch (await resolveInviteMatch(inviteToken, email)) {
    case "valid":
      return null;
    case "email_mismatch":
      return "invite_email_mismatch";
    case "invalid_or_expired":
      return "invalid_invite_token";
    default:
      return "invite_token_validation_error"; // "missing" | "verification_error"
  }
};

/**
 * Gate for SSO just-in-time user provisioning — the orphan-safe, WRITE-FREE decision logic for the
 * Better Auth SSO sign-up flow (introduced by the NextAuth→Better Auth migration, ENG-1054).
 *
 * MUST be called from `databaseHooks.user.create.before`, which Better Auth runs INSIDE the
 * user+account transaction: a `"reject"` there → throw an APIError → the row rolls back, so no orphan
 * user is created (design doc §13; the post-commit `user.create.after` could not reject safely). The
 * `"provision"` decision (resolved org + flags) is carried to the after-hook, which performs the
 * membership writes.
 *
 * Invariants (covered by sso-provisioning.test.ts): `DEFAULT_ORGANIZATION_ID` wins over everything
 * below it; fresh-instance & multi-org bypass all gates; single-org + `SKIP_INVITE_FOR_SSO` requires
 * `DEFAULT_TEAM_ID`; otherwise a valid invite token matching the email is required; the assignment org
 * is the default team's org (skip-invite) or the first org; access control without a callback URL is
 * refused.
 */
export const gateSsoProvisioning = async ({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}): Promise<TSsoProvisioningDecision> => {
  // Formbricks Cloud only: block SSO sign-ups from personal/free/disposable email domains, before any
  // org resolution. Placed above the multi-org / fresh-instance bypass below (Cloud is multi-org, so
  // the bypass would otherwise let these through). Invited users — a valid token whose email matches —
  // are exempt unless SIGNUP_DOMAIN_CHECK_ON_INVITES is set; the exemption reuses the same invite
  // validation as the gate below and runs lazily, only when the domain is actually blocked.
  const isDomainBlocked = await isSignupEmailDomainBlocked(
    email,
    async () => (await validateSsoInviteToken(email, callbackUrl)) === null
  );
  if (isDomainBlocked) {
    return { action: "reject", reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE };
  }

  const signupSource = callbackUrl.includes("token=") ? "invite" : "direct";

  // `DEFAULT_ORGANIZATION_ID` short-circuits every gate below, which is exactly what it did before v5
  // (ENG-2089): the legacy handler only ran its invite/callback-URL checks when the env var was
  // *unset*, and its assignment block ran regardless of the multi-org license. An operator who names
  // one organization for every SSO sign-up has already decided who may join — the IdP is the gate, so
  // there is no invite to check and no org to resolve here. Creation of a missing org, and the role,
  // are settled in the write phase (`ensureDefaultOrganization`).
  if (DEFAULT_ORGANIZATION_ID) {
    return {
      action: "provision",
      organizationId: DEFAULT_ORGANIZATION_ID,
      // The two self-hosting mechanisms are alternatives, not layers: DEFAULT_TEAM_ID's team belongs
      // to whichever org it belongs to, which need not be this one, and joining a team outside your
      // own org is not a thing. Parity with the legacy handler, which had no default-team concept.
      assignToDefaultTeam: false,
      signupSource,
      useDefaultOrganization: true,
    };
  }

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
    const rejectionReason = await validateSsoInviteToken(email, callbackUrl);
    if (rejectionReason) return { action: "reject", reason: rejectionReason };
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
 * The membership WRITES for one resolved organization, retried once and never thrown out of.
 *
 * Extracted from `provisionSsoUserMemberships` to keep that function under the cognitive-complexity
 * budget (the same reason `validateSsoInviteToken` sits outside `gateSsoProvisioning`); its behavior
 * is covered by sso-provisioning.test.ts.
 *
 * The retry exists because the user + account are already committed by Better Auth: throwing here
 * would not roll them back and would break an otherwise successful sign-in. On the final attempt we
 * log an error for alerting instead — there is no automatic retry on later sign-ins, so a sustained
 * failure needs manual reconciliation, and the writes are idempotent (`createMembership` /
 * `createDefaultTeamMembership` upsert) so an operational retry is safe.
 */
const assignSsoUserToOrganization = async ({
  userId,
  organizationId,
  role,
  assignToDefaultTeam,
}: {
  userId: string;
  organizationId: string;
  role: TOrganizationRole;
  assignToDefaultTeam: boolean;
}): Promise<void> => {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await createMembership(
          organizationId,
          userId,
          { role, accepted: true },
          { projection: "deferred", transaction: tx }
        );
        if (assignToDefaultTeam) {
          await createDefaultTeamMembership(userId, { projection: "deferred", transaction: tx });
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
      await reconcileOrganizationMembership(organizationId, userId);
      if (assignToDefaultTeam && DEFAULT_TEAM_ID) {
        const defaultTeamId = DEFAULT_TEAM_ID;
        await runPostCommitProjection("sso_default_team_membership_create", () =>
          reconcileTeamWorkspaceRelationships({ teamMemberships: [{ teamId: defaultTeamId, userId }] })
        );
      }
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        logger.error(error, "SSO provisioning: failed to assign new SSO user to its organization");
      }
    }
  }
};

/**
 * Provisioning WRITES for a newly created SSO user — mirrors the legacy NextAuth SSO provisioning
 * writes. Called from
 * `databaseHooks.user.create.after` (post-commit), so it CANNOT share Better Auth's user/account
 * transaction (design doc §13). The membership writes and their retry live in
 * `assignSsoUserToOrganization` above; analytics/CRM sync runs regardless of them (parity).
 */
export const provisionSsoUserMemberships = async ({
  userId,
  email,
  name,
  provider,
  organizationId,
  assignToDefaultTeam,
  signupSource,
  useDefaultOrganization = false,
  attributionProperties = {},
}: {
  userId: string;
  email: string;
  name?: string | null;
  provider: IdentityProvider;
  organizationId: string | null;
  assignToDefaultTeam: boolean;
  signupSource: "invite" | "direct";
  /** See `TSsoProvisioningDecision`: find-or-create `organizationId` and derive the role from that. */
  useDefaultOrganization?: boolean;
  /** Marketing attribution read from the request cookie in `user.create.before`. */
  attributionProperties?: Record<string, string>;
}): Promise<void> => {
  // Resolved before the writes so a create is attempted at most once per sign-up. On the legacy path
  // (no `DEFAULT_ORGANIZATION_ID`) the gate already resolved the org and the role stays `member`, as
  // it has been since the migration; the default-organization path find-or-creates it instead.
  let assignment: TDefaultOrganizationAssignment | null = null;
  if (useDefaultOrganization) {
    assignment = await ensureDefaultOrganization(name || email.split("@")[0]);
  } else if (organizationId) {
    assignment = { organizationId, role: "member" };
  }

  if (assignment) {
    await assignSsoUserToOrganization({
      userId,
      organizationId: assignment.organizationId,
      role: assignment.role,
      assignToDefaultTeam,
    });
  }

  // Best-effort analytics + CRM sync, regardless of org assignment (parity with provisionNewSsoUser).
  createBrevoCustomer({ id: userId, email });
  // Identify the person before the sign-up capture so `user_signed_up` lands on an identified
  // PostHog person (fires $identify + sets email/name) — parity with the credentials sign-up path.
  identifyPostHogPerson(userId, { email, name });
  capturePostHogEvent(userId, "user_signed_up", {
    // Spread attribution first so trusted, server-computed props always win on a name clash.
    ...attributionProperties,
    auth_provider: provider,
    email_domain: email.split("@")[1],
    signup_source: signupSource,
    invite_organization_id: assignment ? assignment.organizationId : null,
  });
};
