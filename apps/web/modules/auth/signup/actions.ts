"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  InvalidInputError,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SIGNUP_DISABLED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
  UnknownError,
} from "@formbricks/types/errors";
import { ZUser, ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD, IS_TURNSTILE_CONFIGURED, TURNSTILE_SECRET_KEY } from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createOrganization, getOrganization } from "@/lib/organization/service";
import {
  capturePostHogEvent,
  getEmailDomain,
  groupIdentifyPostHog,
  identifyPostHogPerson,
} from "@/lib/posthog";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { ATTRIBUTION_COOKIE_NAME, getAttributionPropertiesFromCookies } from "@/modules/auth/lib/attribution";
import { auth } from "@/modules/auth/lib/auth";
import { isPasswordCompromisedError } from "@/modules/auth/lib/better-auth-hibp";
import {
  DISCOVERY_SOURCES,
  MAX_DISCOVERY_SOURCE_DETAIL_LENGTH,
  normalizeDiscoverySourceDetail,
} from "@/modules/auth/lib/discovery-source";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isUninvitedSignupAllowed } from "@/modules/auth/lib/signup-policy";
import {
  markSignupDomainAllowed,
  runWithSignupRequestContext,
} from "@/modules/auth/lib/signup-request-context";
import { updateUser } from "@/modules/auth/lib/user";
import {
  type InviteMatch,
  deleteInvite,
  getInvite,
  resolveInviteMatch,
} from "@/modules/auth/signup/lib/invite";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { verifyTurnstileToken } from "@/modules/auth/signup/lib/utils";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZCreatedUser = ZUser.pick({
  name: true,
  email: true,
  locale: true,
  id: true,
  notificationSettings: true,
});

type TCreatedUser = z.infer<typeof ZCreatedUser>;

const ZCreateUserAction = z
  .object({
    name: ZUserName,
    email: ZUserEmail,
    password: ZUserPassword,
    inviteToken: z.string().optional(),
    userLocale: ZUserLocale.optional(),
    turnstileToken: z
      .string()
      .optional()
      .refine(
        (token) => !IS_TURNSTILE_CONFIGURED || (IS_TURNSTILE_CONFIGURED && token),
        "CAPTCHA verification required"
      ),
    subscribeToSecurityUpdates: z.boolean().optional(),
    subscribeToProductUpdates: z.boolean().optional(),
    discoverySource: z.enum(DISCOVERY_SOURCES).optional(),
    discoverySourceDetail: z.string().max(MAX_DISCOVERY_SOURCE_DETAIL_LENGTH).optional(),
  })
  .transform((data) => ({
    ...data,
    discoverySourceDetail: normalizeDiscoverySourceDetail(data.discoverySource, data.discoverySourceDetail),
  }));

async function verifyTurnstileIfConfigured(turnstileToken: string | undefined): Promise<void> {
  if (!IS_TURNSTILE_CONFIGURED) return;

  if (!turnstileToken || !TURNSTILE_SECRET_KEY) {
    throw new UnknownError("Server configuration error");
  }

  const isHuman = await verifyTurnstileToken(TURNSTILE_SECRET_KEY, turnstileToken);
  if (!isHuman) {
    throw new UnknownError("reCAPTCHA verification failed");
  }
}

/**
 * Whether THIS request created the account, as a discriminated union rather than a boolean flag.
 *
 * Everything downstream of sign-up — invite acceptance, organization creation, the mailing-list
 * subscription, the analytics identify, the `created` audit event — may only run for `"created"`.
 * `createUserAction` is unauthenticated, so running any of it against an account the caller has not
 * proven they own is an authorization defect (ENG-2091). Encoding that in the type keeps the guard
 * from being dropped by a later refactor: `handlePostUserCreation` accepts only the `"created"`
 * variant, so misuse is a compile error rather than a silent privilege hole.
 */
type TSignUpOutcome =
  | { status: "created"; user: TCreatedUser }
  // Carries no user on purpose. Nothing downstream may act on a pre-existing account, so not handing
  // one out is the cheapest way to keep it that way — there is no object to accidentally thread into a
  // side effect later.
  | { status: "already_existed" };

async function signUpUserSafely(
  email: string,
  name: string,
  password: string,
  userLocale: z.infer<typeof ZUserLocale> | undefined
): Promise<TSignUpOutcome> {
  const normalizedEmail = email.toLowerCase();

  // Assigned on every path that does not throw; `undefined` is only in the type because TS cannot see
  // that across the try/catch. If it ever were undefined — Better Auth changing its response shape —
  // the id comparison below fails and the request is treated as already-existed, so no side effect
  // runs against an account we cannot attribute. Degrading that way is the safe direction.
  let signedUpUserId: string | undefined;
  try {
    // Better Auth-native signup: creates the User + a bcrypt credential Account (via the password hook
    // in auth.ts) and, when verification is enabled, sends Better Auth's verification email (sendOnSignUp;
    // callbackURL defaults to "/"). We deliberately do NOT pass a /invite callbackURL for invite signups:
    // the invite is accepted and deleted in handlePostUserCreation right after this, so by the time the
    // verification link is clicked /invite would render "Invite Not Found" (ENG-1527) — the verified,
    // already-provisioned user lands on the app home instead. Replaces the manual hash + createUser + the
    // legacy verification-token email.
    const signUpResult = await auth.api.signUpEmail({
      body: { email: normalizedEmail, password, name },
      headers: await headers(),
    });
    signedUpUserId = signUpResult.user.id;
  } catch (error) {
    // A breached password is rejected before any user is created — surface it as an expected error
    // with a stable code the sign-up form maps to a localized message (not an enumeration signal).
    if (isPasswordCompromisedError(error)) {
      throw new InvalidInputError(PASSWORD_COMPROMISED_ERROR_CODE);
    }
    // Enumeration-safe: a duplicate email resolves to "already existed", not a surfaced error.
    // Reachable only when Better Auth is configured to THROW on a duplicate — see the id check below.
    if (await getUserByEmail(normalizedEmail)) {
      return { status: "already_existed" };
    }
    throw error;
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    // signUpEmail succeeded but the row can't be loaded — an invariant violation. Fail loud rather
    // than returning { success: true } with no user, which would skip org creation / invite acceptance.
    throw new UnknownError("Failed to load user after signup");
  }

  // ENG-2091: a duplicate email does NOT throw here. Better Auth takes an enumeration-safe branch
  // whenever `emailAndPassword.requireEmailVerification || autoSignIn === false` — auth.ts sets both —
  // which hashes the password for timing parity, then returns HTTP 200 carrying a SYNTHETIC user: a
  // freshly generated id, no row written, no credential linked and (because it returns before the send)
  // no verification email. So the id it hands back, not a thrown error, is what distinguishes the two:
  // a synthetic id is never in the database. Do not "simplify" this to the catch above — that branch
  // only fires under a configuration that makes Better Auth throw USER_ALREADY_EXISTS instead, which
  // is why both signals are kept.
  if (user.id !== signedUpUserId) {
    return { status: "already_existed" };
  }

  // signUpEmail can't carry the chosen locale (not a Better Auth field), so apply it afterwards — only
  // for an account this request created. Applying it on the already-existed path would let an
  // anonymous caller rewrite an existing user's locale by POSTing their address at sign-up.
  if (userLocale && user.locale !== userLocale) {
    await updateUser(user.id, { locale: userLocale });
    return { status: "created", user: { ...user, locale: userLocale } };
  }

  return { status: "created", user };
}

async function handleInviteAcceptance(
  ctx: ActionClientCtx,
  inviteToken: string,
  user: TCreatedUser
): Promise<void> {
  // An invite grants a specific address a specific role in a specific organization. Verifying the
  // signature and loading the row is not enough: without matching the token's email against the account
  // being created, anyone holding an invite link — they get forwarded, pasted into tickets, and land in
  // referrer logs — could redeem it with an arbitrary address and take the invited role, which may be
  // manager or owner. `resolveInviteMatch` also enforces the invite's expiry, which this path skipped.
  //
  // Deliberately re-checked here even though `createUserAction` already rejected an invalid token
  // before creating the user: this is the function that performs the grant, so the check belongs
  // beside it and keeps holding if another caller ever appears. The cost is one extra HMAC verify —
  // the invite lookup behind it is request-cached, so no second query.
  const inviteMatch = await resolveInviteMatch(inviteToken, user.email);
  if (inviteMatch !== "valid") {
    logger.warn({ inviteMatch }, "Rejected invite acceptance during sign-up");
    throw new InvalidInputError(INVITE_TOKEN_INVALID_ERROR_CODE);
  }

  const inviteTokenData = verifyInviteToken(inviteToken);
  const invite = await getInvite(inviteTokenData.inviteId);

  if (!invite) {
    throw new Error("Invalid invite ID");
  }
  ctx.auditLoggingCtx.organizationId = invite.organizationId;

  await createMembership(invite.organizationId, user.id, {
    accepted: true,
    role: invite.role,
  });

  try {
    const invitedOrganization = await getOrganization(invite.organizationId);
    if (invitedOrganization) {
      groupIdentifyPostHog("organization", invitedOrganization.id, {
        name: invitedOrganization.name,
        email_domain: getEmailDomain(invite.creator.email),
      });
    }
  } catch (error) {
    logger.warn({ error, organizationId: invite.organizationId }, "Failed to identify org group in PostHog");
  }

  if (invite.teamIds) {
    await createTeamMembership(
      {
        organizationId: invite.organizationId,
        role: invite.role,
        teamIds: invite.teamIds,
      },
      user.id
    );
  }

  await updateUser(user.id, {
    notificationSettings: {
      alert: {},

      unsubscribedOrganizationIds: [invite.organizationId],
    },
  });

  await sendInviteAcceptedEmail(
    invite.creator.name ?? "",
    user.name,
    invite.creator.email,
    invite.creator.locale
  );
  await deleteInvite(invite.id);
}

async function handleOrganizationCreation(ctx: ActionClientCtx, user: TCreatedUser): Promise<void> {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) return;

  const organization = await createOrganization({ name: `${user.name}'s Organization` });
  ctx.auditLoggingCtx.organizationId = organization.id;

  await createMembership(organization.id, user.id, {
    role: "owner",
    accepted: true,
  });

  // Stripe setup must run AFTER membership is created so the owner email is available
  if (IS_FORMBRICKS_CLOUD) {
    ensureCloudStripeSetupForOrganization(organization.id).catch((error) => {
      logger.error(
        { error, organizationId: organization.id },
        "Stripe setup failed after organization creation"
      );
    });
  }

  const workspace = await createWorkspace(organization.id, {
    name: DEFAULT_WORKSPACE_NAME,
  });

  groupIdentifyPostHog("organization", organization.id, {
    name: organization.name,
    email_domain: getEmailDomain(user.email),
  });
  groupIdentifyPostHog("workspace", workspace.id, { name: workspace.name });

  capturePostHogEvent(
    user.id,
    "organization_created",
    {
      organization_id: organization.id,
      is_first_org: true,
    },
    { organizationId: organization.id, workspaceId: workspace.id }
  );

  capturePostHogEvent(
    user.id,
    "workspace_created",
    {
      organization_id: organization.id,
      workspace_id: workspace.id,
      name: workspace.name,
    },
    { organizationId: organization.id, workspaceId: workspace.id }
  );

  await updateUser(user.id, {
    notificationSettings: {
      ...user.notificationSettings,
      alert: { ...user.notificationSettings?.alert },

      unsubscribedOrganizationIds: Array.from(
        new Set([...(user.notificationSettings?.unsubscribedOrganizationIds ?? []), organization.id])
      ),
    },
  });
}

/**
 * Provisioning that must only ever follow a real account creation. Takes the `"created"` outcome
 * rather than a bare user so an `"already_existed"` sign-up cannot reach it (ENG-2091).
 */
async function handlePostUserCreation(
  ctx: ActionClientCtx,
  { user }: Extract<TSignUpOutcome, { status: "created" }>,
  inviteToken: string | undefined
): Promise<void> {
  if (inviteToken) {
    await handleInviteAcceptance(ctx, inviteToken, user);
  } else {
    await handleOrganizationCreation(ctx, user);
  }
  // Better Auth sends the verification email itself during signUpEmail (sendOnSignUp) — no manual
  // send here. The legacy EMAIL_VERIFICATION_DISABLED branch (ENG-1527) is folded into auth.ts'
  // requireEmailVerification config and the callbackURL chosen in signUpUserSafely.
}

/**
 * The two sign-up gates that used to live only in `signup/page.tsx`, enforced here so a direct POST to
 * this action cannot walk around them. Extracted from `createUserAction` to keep that function within
 * the cognitive-complexity budget.
 */
async function assertSignupPolicyAllows(
  inviteToken: string | undefined,
  inviteMatch: InviteMatch
): Promise<void> {
  // A supplied-but-unusable invite is rejected before the user row is created, so a bad token can't
  // leave an orphaned account behind (handleInviteAcceptance would otherwise throw after signup).
  if (inviteToken && inviteMatch !== "valid") {
    logger.warn({ inviteMatch }, "Rejected sign-up with an unusable invite token");
    throw new InvalidInputError(INVITE_TOKEN_INVALID_ERROR_CODE);
  }

  // A valid invite is an independent grant — it admits the holder whatever the instance policy says.
  if (inviteMatch === "valid") {
    return;
  }

  // No invite, so it comes down to instance policy: public sign-up genuinely open, or the initial
  // administrator during fresh-instance setup, who has no invite to present. That predicate is shared
  // with the Better Auth hooks (signup-policy.ts) — writing it out twice is what left Better Auth's
  // native /sign-up/email open after this action was fixed (ENG-2073 → ENG-2293).
  if (!(await isUninvitedSignupAllowed())) {
    throw new InvalidInputError(SIGNUP_DISABLED_ERROR_CODE);
  }
}

export const createUserAction = actionClient.inputSchema(ZCreateUserAction).action(
  withAuditLogging("created", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.signup);
    await verifyTurnstileIfConfigured(parsedInput.turnstileToken);

    // Normalized once, up front, and used for every downstream decision. The sign-up form always sends
    // this field as `inviteToken ?? ""`, so an ordinary uninvited sign-up arrives with an empty string —
    // anything blank has to mean "no invite" everywhere, or the checks below disagree with
    // `handlePostUserCreation` about which path the request is on.
    const inviteToken = parsedInput.inviteToken?.trim() || undefined;
    const inviteMatch = await resolveInviteMatch(inviteToken, parsedInput.email);

    await assertSignupPolicyAllows(inviteToken, inviteMatch);

    // Formbricks Cloud only: reject personal/free/disposable email domains before any user is created.
    // Invited users are exempt unless SIGNUP_DOMAIN_CHECK_ON_INVITES is enabled.
    if (await isSignupEmailDomainBlocked(parsedInput.email, async () => inviteMatch === "valid")) {
      throw new InvalidInputError(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    }

    // The domain policy passed, so mark the request scope: user.create.before uses this to tell a
    // sign-up that went through this action apart from a direct POST to Better Auth's native
    // /sign-up/email endpoint (which bypasses the action and is re-checked in the hook).
    const outcome = await runWithSignupRequestContext(() => {
      markSignupDomainAllowed();
      return signUpUserSafely(
        parsedInput.email,
        parsedInput.name,
        parsedInput.password,
        parsedInput.userLocale
      );
    });

    // Everything below is provisioning + analytics for a NEW account. On "already_existed" the response
    // is deliberately identical (enumeration-safe) but nothing runs: this endpoint is unauthenticated,
    // so the caller has proven nothing about an account that already exists (ENG-2091).
    if (outcome.status === "created") {
      const { user } = outcome;
      await handlePostUserCreation(ctx, outcome, inviteToken);

      await subscribeUserToMailingList({
        email: user.email,
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        subscribeToSecurityUpdates: parsedInput.subscribeToSecurityUpdates,
        subscribeToProductUpdates: parsedInput.subscribeToProductUpdates,
      });

      const cookieStore = await cookies();
      const hasAttributionCookie = cookieStore.get(ATTRIBUTION_COOKIE_NAME) !== undefined;
      const attributionProperties = getAttributionPropertiesFromCookies(cookieStore);

      identifyPostHogPerson(user.id, {
        email: user.email,
        name: user.name,
        email_domain: getEmailDomain(user.email),
      });
      capturePostHogEvent(
        user.id,
        "user_signed_up",
        {
          // Spread attribution first so trusted, server-computed props always win on a name clash.
          ...attributionProperties,
          auth_provider: "credentials",
          email_domain: getEmailDomain(user.email),
          signup_source: inviteToken ? "invite" : "direct",
          invite_organization_id: ctx.auditLoggingCtx.organizationId ?? null,
          discovery_source: parsedInput.discoverySource ?? null,
          discovery_source_detail: parsedInput.discoverySourceDetail ?? null,
        },
        ctx.auditLoggingCtx.organizationId
          ? { organizationId: ctx.auditLoggingCtx.organizationId }
          : undefined
      );

      // Clear whenever a cookie is present (even malformed/empty) so it cannot bleed onto
      // later events and a stale/legacy value cannot block future first-touch capture.
      if (hasAttributionCookie) {
        try {
          cookieStore.delete(ATTRIBUTION_COOKIE_NAME);
        } catch {
          // Best-effort; the short cookie lifetime is the backstop.
        }
      }

      // Inside the "created" branch: an audit record claiming a user was created must only exist when
      // one was. Previously this ran unconditionally, so a duplicate sign-up wrote a `created` event
      // attributed to the PRE-EXISTING user and carrying their object (ENG-2091 / S1).
      ctx.auditLoggingCtx.userId = user.id;
      ctx.auditLoggingCtx.newObject = user;
    } else {
      // No account was created, so no `created` event may be written. Attribution alone is not enough:
      // `withAuditLogging` wraps the whole action with a fixed action name and cannot see which branch
      // ran, so without this it still logged a SUCCESSFUL `created` for an UNKNOWN_DATA target — a false
      // creation record on audit-enabled deployments (raised by @BhagyaAmarasinghe in review).
      //
      // The response stays byte-identical either way (ENG-2099) — this changes only what we record, and
      // only on the success path, so a genuine failure is still audited.
      ctx.auditLoggingCtx.suppressEvent = true;
    }

    // Deliberately invariant: the response never varies with whether the address already had an
    // account, nor with what happened to the verification email. Both would make it a lookup
    // (ENG-2099). The verification-requested screen the form lands on is phrased conditionally and
    // carries a log-in link, so the existing-account visitor still has a way out.
    return {
      success: true,
    };
  })
);
