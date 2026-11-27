import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import type { TAuthzedProjectionResult } from "@/lib/authzed/projection";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO, WEBAPP_URL } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { isSetupTokenConfigured } from "@/lib/instance/setup-token";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent, identifyPostHogPerson } from "@/lib/posthog";
import { loggableError } from "@/lib/utils/loggable-error";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import type { TSsoProvisioningRejectReason } from "@/modules/auth/lib/sso-provisioning-reject-reasons";
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
  // The reason is a closed set, not a free string: it leaves the server as the `?error=` code the
  // login form and the callback-outcome log both key on (ENG-2882).
  | { action: "reject"; reason: TSsoProvisioningRejectReason }
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
      /**
       * ENG-2247: the fresh-instance exception, and nothing else, admitted this sign-up — so the row it
       * creates carries the single-use bootstrap marker. Absent on every other provision path.
       */
      isBootstrapAdmin?: boolean;
      /**
       * ENG-7313: the instance was fresh when this sign-up was gated. The after-hook records the
       * `InstanceSetup` marker at once, including on the multi-org and `DEFAULT_ORGANIZATION_ID` paths
       * where `isBootstrapAdmin` is absent. Optional, so a non-fresh provision carries nothing.
       */
      wasFreshInstance?: boolean;
      /**
       * ENG-7097: the role of the invite whose token the callback URL carried, when that token is valid,
       * matches the sign-up's email and belongs to `organizationId`. Absent otherwise: a role is never
       * granted on an email match alone, since that email may be one the IdP does not vouch for.
       */
      inviteRole?: TOrganizationRole;
    };

/**
 * Validates the invite token carried on an SSO callback URL (only consulted when invites aren't
 * skipped). Returns a rejection reason, or null when the invite is valid. Extracted from
 * gateSsoProvisioning so that gate stays under the cognitive-complexity budget — its behavior is
 * covered by sso-provisioning.test.ts.
 */
const validateSsoInviteToken = async (
  email: string,
  callbackUrl: string
): Promise<TSsoProvisioningRejectReason | null> => {
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

/** The gate could not read the invite from the database, so it cannot tell which role the invite grants. */
const INVITE_LOOKUP_FAILED = "invite_lookup_failed";

/**
 * ENG-7097: the role of the invite named by the token on the callback URL, or undefined.
 *
 * The invite page keeps an existing member's role, so a membership provisioned here has to carry the
 * invite's role already. Only a token proves the sign-up came from that invite's link, which was
 * mailed to the invited address; an email match alone does not, because on the
 * `DEFAULT_ORGANIZATION_ID` and `SKIP_INVITE_FOR_SSO` paths the IdP's email may be unverified.
 *
 * A missing, unreadable or mismatched token, and an invite that is gone, foreign or expired, all mean
 * "no invite role". A failed database read is different: the invite may be valid, and provisioning
 * with the default role would stick, because the invite page no longer raises an existing role. That
 * case returns `INVITE_LOOKUP_FAILED` so the gate rejects and the user can retry the sign-in.
 */
const getSsoInviteRole = async (
  email: string,
  callbackUrl: string,
  organizationId: string
): Promise<TOrganizationRole | undefined | typeof INVITE_LOOKUP_FAILED> => {
  let inviteId: string;
  try {
    const inviteToken = new URL(callbackUrl, WEBAPP_URL).searchParams.get("token");
    if (!inviteToken) return undefined;
    const verified = verifyInviteToken(inviteToken);
    if (verified.email.trim().toLowerCase() !== email.trim().toLowerCase()) return undefined;
    inviteId = verified.inviteId;
  } catch (error) {
    logger.warn(loggableError(error), "SSO provisioning: could not read the sign-up's invite token");
    return undefined;
  }

  try {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      select: { role: true, organizationId: true, expiresAt: true },
    });
    if (invite?.organizationId !== organizationId || invite.expiresAt < new Date()) return undefined;
    return invite.role;
  } catch (error) {
    logger.error(loggableError(error), "SSO provisioning: could not look up the sign-up's invite");
    return INVITE_LOOKUP_FAILED;
  }
};

type TProvisionDecision = Extract<TSsoProvisioningDecision, { action: "provision" }>;

/**
 * Adds the invite's role to a provision decision, leaving the field absent (not `undefined`) without
 * one. Rejects instead when the invite could not be looked up (see `getSsoInviteRole`).
 */
const withInviteRole = async (
  decision: TProvisionDecision & { organizationId: string },
  email: string,
  callbackUrl: string
): Promise<TSsoProvisioningDecision> => {
  const inviteRole = await getSsoInviteRole(email, callbackUrl, decision.organizationId);
  if (inviteRole === INVITE_LOOKUP_FAILED) {
    return { action: "reject", reason: "invite_token_validation_error" };
  }
  return inviteRole ? { ...decision, inviteRole } : decision;
};

/**
 * ENG-2247: whether the fresh-instance exception — and nothing else — is what admits this sign-up, so
 * the row it creates carries the single-use bootstrap marker.
 *
 * `isFirstUser` alone is not enough. Its caller's branch admits everyone once multi-org is on, where
 * freshness is incidental rather than the grant, and marking there would make the second SSO account
 * ever created collide on the unique index.
 *
 * A named function rather than an inline expression so `gateSsoProvisioning` stays inside the
 * cognitive-complexity budget — the same reason `validateSsoInviteToken` sits outside it.
 */
const admitsAsBootstrapAdmin = (isFirstUser: boolean, isMultiOrgEnabled: boolean): boolean =>
  isFirstUser && !isMultiOrgEnabled;

/** Only a fresh instance carries the marker flag; a non-fresh provision carries nothing. */
const freshInstanceMarker = (wasFreshInstance: boolean): { wasFreshInstance?: true } => {
  if (!wasFreshInstance) return {};
  return { wasFreshInstance: true };
};

/**
 * The refusals that come before any organization is resolved: the Cloud email-domain block and, with
 * `SETUP_TOKEN` set, a fresh instance that only the setup form may claim.
 */
const getSsoPreflightRejection = async (
  email: string,
  callbackUrl: string,
  wasFreshInstance: boolean
): Promise<TSsoProvisioningDecision | null> => {
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

  // ENG-7313: with SETUP_TOKEN set, a fresh instance is claimed only through the setup form, which carries
  // the token; SSO has no way to present it. Checked before DEFAULT_ORGANIZATION_ID, whose branch would
  // otherwise create that organization and make any account at the IdP its owner. The user sees the same
  // answer as SSO on a fresh instance without a default organization (there is no organization to join
  // yet); the log says why, for the operator.
  if (wasFreshInstance && isSetupTokenConfigured()) {
    logger.warn(
      { reason: "setup_token_required" },
      "Refused an SSO sign-up: the instance is not set up and SETUP_TOKEN is set; create the administrator through the setup form"
    );
    return { action: "reject", reason: "no_organization_found" };
  }

  return null;
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
 * Invariants (covered by sso-provisioning.test.ts): with `SETUP_TOKEN` set, a fresh instance is refused
 * first; `DEFAULT_ORGANIZATION_ID` wins over everything below it; fresh-instance & multi-org bypass all
 * gates; single-org + `SKIP_INVITE_FOR_SSO` requires `DEFAULT_TEAM_ID`; otherwise a valid invite token
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
  // ENG-7313: read once. It refuses a fresh instance while SETUP_TOKEN is set, and the first SSO user of a
  // fresh instance writes the setup marker at creation on every provision path, not only the
  // bootstrap-administrator one.
  const wasFreshInstance = await getIsFreshInstance();
  const rejection = await getSsoPreflightRejection(email, callbackUrl, wasFreshInstance);
  if (rejection) return rejection;
  const signupSource = callbackUrl.includes("token=") ? "invite" : "direct";

  // `DEFAULT_ORGANIZATION_ID` short-circuits every gate below, which is exactly what it did before v5
  // (ENG-2089): the legacy handler only ran its invite/callback-URL checks when the env var was
  // *unset*, and its assignment block ran regardless of the multi-org license. An operator who names
  // one organization for every SSO sign-up has already decided who may join — the IdP is the gate, so
  // there is no invite to check and no org to resolve here. Creation of a missing org, and the role,
  // are settled in the write phase (`ensureDefaultOrganization`).
  if (DEFAULT_ORGANIZATION_ID) {
    // No invite is required here, but one the sign-up did arrive with still sets the role.
    return withInviteRole(
      {
        action: "provision",
        organizationId: DEFAULT_ORGANIZATION_ID,
        // The two self-hosting mechanisms are alternatives, not layers: DEFAULT_TEAM_ID's team belongs
        // to whichever org it belongs to, which need not be this one, and joining a team outside your
        // own org is not a thing. Parity with the legacy handler, which had no default-team concept.
        assignToDefaultTeam: false,
        signupSource,
        useDefaultOrganization: true,
        ...freshInstanceMarker(wasFreshInstance),
      },
      email,
      callbackUrl
    );
  }

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  // Past the preflight, a fresh instance means no setup token is configured.
  const isFirstUser = wasFreshInstance;

  // Fresh instance or multi-org: create the user with no org auto-assignment (handled by onboarding
  // / explicit invites elsewhere).
  if (isFirstUser || isMultiOrgEnabled) {
    return {
      action: "provision",
      organizationId: null,
      assignToDefaultTeam: false,
      signupSource,
      isBootstrapAdmin: admitsAsBootstrapAdmin(isFirstUser, isMultiOrgEnabled),
      ...freshInstanceMarker(wasFreshInstance),
    };
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

  return withInviteRole(
    {
      action: "provision",
      organizationId: organization.id,
      assignToDefaultTeam: Boolean(SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID),
      signupSource,
    },
    email,
    callbackUrl
  );
};

/** Runs `step`, retrying once. Logs an error and returns false if both attempts fail; never throws. */
const withOneRetry = async (failureMessage: string, step: () => Promise<unknown>): Promise<boolean> => {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await step();
      return true;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        logger.error(loggableError(error), `SSO provisioning: ${failureMessage}`);
      }
    }
  }
  return false;
};

/**
 * AuthZed projections are best-effort: they log a failure and return it as a status instead of
 * throwing. Throwing on that status lets `withOneRetry` retry the projection.
 */
class SsoProjectionFailedError extends Error {
  readonly code: string;
  constructor(operation: string, code: string) {
    super(`AuthZed projection ${operation} failed`);
    this.name = "SsoProjectionFailedError";
    this.code = code;
  }
}

const throwIfProjectionFailed = (operation: string, result: TAuthzedProjectionResult): void => {
  if (result.status === "failed") throw new SsoProjectionFailedError(operation, result.code);
};

/**
 * The membership WRITES for one resolved organization, retried once and never thrown out of.
 *
 * Extracted from `provisionSsoUserMemberships` to keep that function under the cognitive-complexity
 * budget (the same reason `validateSsoInviteToken` sits outside `gateSsoProvisioning`); its behavior
 * is covered by sso-provisioning.test.ts.
 *
 * The retries exist because the user + account are already committed by Better Auth: throwing here
 * would not roll them back and would break an otherwise successful sign-in. On the final attempt we
 * log an error for alerting instead — there is no automatic retry on later sign-ins, so a sustained
 * failure needs manual reconciliation.
 *
 * The database writes and the SpiceDB projection retry separately. A failed transaction rolled back,
 * so writing the same role again is safe. Once it has committed, only the projection is retried: a
 * second `createMembership` would update the stored role back to `role`, undoing a change an
 * administrator made in between (ENG-7097).
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
  const committed = await withOneRetry("failed to assign new SSO user to its organization", () =>
    prisma.$transaction(async (tx) => {
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
    })
  );
  if (!committed) return;

  await withOneRetry("failed to project new SSO user's organization membership", async () => {
    throwIfProjectionFailed(
      "sso_organization_membership_create",
      await reconcileOrganizationMembership(organizationId, userId)
    );
    if (assignToDefaultTeam && DEFAULT_TEAM_ID) {
      throwIfProjectionFailed(
        "sso_default_team_membership_create",
        await reconcileTeamWorkspaceRelationships({ teamMemberships: [{ teamId: DEFAULT_TEAM_ID, userId }] })
      );
    }
  });
};

// Restricted roles rank below `member`: they see less of the organization, not more.
const ORGANIZATION_ROLE_RANK: Record<TOrganizationRole, number> = {
  owner: 4,
  manager: 3,
  member: 2,
  billing: 1,
  dashboard_viewer: 0,
};

/**
 * ENG-7097: the role a new SSO member gets, given the gate's token-validated invite role.
 *
 * On the legacy path the assignment's `member` is a placeholder, so the invite's role replaces it, a
 * restricted one included. On the `DEFAULT_ORGANIZATION_ID` path the assignment's role is the
 * operator's configured one (or `owner` for the sign-up that created the org), and an invite may only
 * raise it: a lower invite must not demote below what the operator configured.
 */
const resolveSsoMembershipRole = (
  assignmentRole: TOrganizationRole,
  inviteRole: TOrganizationRole | undefined,
  useDefaultOrganization: boolean
): TOrganizationRole => {
  if (!inviteRole) return assignmentRole;
  if (!useDefaultOrganization) return inviteRole;
  return ORGANIZATION_ROLE_RANK[inviteRole] > ORGANIZATION_ROLE_RANK[assignmentRole]
    ? inviteRole
    : assignmentRole;
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
  inviteRole,
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
  /** See `TSsoProvisioningDecision`: set only when the gate validated the sign-up's invite token. */
  inviteRole?: TOrganizationRole;
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
      role: resolveSsoMembershipRole(assignment.role, inviteRole, useDefaultOrganization),
      assignToDefaultTeam,
    });
  }

  // Best-effort analytics + CRM sync, regardless of org assignment (parity with provisionNewSsoUser).
  void createBrevoCustomer({ id: userId, email });
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
