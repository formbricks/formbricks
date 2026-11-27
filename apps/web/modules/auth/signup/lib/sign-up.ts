import "server-only";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  InvalidInputError,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SETUP_TOKEN_INVALID_ERROR_CODE,
  SIGNUP_DISABLED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
  UnknownError,
} from "@formbricks/types/errors";
import { ZUser, ZUserLocale } from "@formbricks/types/user";
import type { TSignupBody } from "@/app/api/internal/signups/schemas";
import {
  AUDIT_LOG_ENABLED,
  IS_FORMBRICKS_CLOUD,
  IS_TURNSTILE_CONFIGURED,
  TURNSTILE_SECRET_KEY,
} from "@/lib/constants";
import { markInstanceSetupCompleted } from "@/lib/instance/service";
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
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { ATTRIBUTION_COOKIE_NAME, getAttributionPropertiesFromCookies } from "@/modules/auth/lib/attribution";
import { auth } from "@/modules/auth/lib/auth";
import { isPasswordCompromisedError } from "@/modules/auth/lib/better-auth-hibp";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  createDecoySignupIntentToken,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { logClosedSignupRejection, resolveUninvitedSignupAdmission } from "@/modules/auth/lib/signup-policy";
import {
  markBootstrapAdminSignup,
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
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import {
  UNKNOWN_AUDIT_REQUEST_METADATA,
  getAuditRequestMetadata,
} from "@/modules/ee/audit-logs/lib/request-metadata";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { TAuditRequestMetadata } from "@/modules/ee/audit-logs/types/request-metadata";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const _ZCreatedUser = ZUser.pick({
  name: true,
  email: true,
  locale: true,
  id: true,
  notificationSettings: true,
});

export type TCreatedUser = z.infer<typeof _ZCreatedUser>;

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
 * `POST /api/internal/signups` is unauthenticated, so running any of it against an account the caller
 * has not proven they own is an authorization defect (ENG-2091). Encoding that in the type keeps the
 * guard from being dropped by a later refactor: `handlePostUserCreation` accepts only the `"created"`
 * variant, so misuse is a compile error rather than a silent privilege hole.
 */
type TSignUpOutcome =
  | { status: "created"; user: TCreatedUser }
  // Carries no user on purpose. Nothing downstream may act on a pre-existing account, so not handing
  // one out is the cheapest way to keep it that way — there is no object to accidentally thread into a
  // side effect later.
  | { status: "already_existed" };

async function signUpUserSafely(email: string, name: string, password: string): Promise<TSignUpOutcome> {
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

  return { status: "created", user };
}

/**
 * What provisioning managed to create, filled in as it goes. A step after the organization exists can
 * still throw; the audit record must then still name the organization the account belongs to.
 */
type TProvisioningTrail = { organizationId?: string };

/** Grant the invited membership, recording the organization it joined in the trail. */
async function handleInviteAcceptance(
  inviteToken: string,
  user: TCreatedUser,
  trail: TProvisioningTrail
): Promise<void> {
  // An invite grants a specific address a specific role in a specific organization. Verifying the
  // signature and loading the row is not enough: without matching the token's email against the account
  // being created, anyone holding an invite link — they get forwarded, pasted into tickets, and land in
  // referrer logs — could redeem it with an arbitrary address and take the invited role, which may be
  // manager or owner. `resolveInviteMatch` also enforces the invite's expiry, which this path skipped.
  //
  // Deliberately re-checked here even though `signUp` already rejected an invalid token before creating
  // the user: this is the function that performs the grant, so the check belongs beside it and keeps
  // holding if another caller ever appears. The cost is one extra HMAC verify — the invite lookup behind
  // it is request-cached, so no second query.
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

  await createMembership(invite.organizationId, user.id, {
    accepted: true,
    role: invite.role,
  });
  trail.organizationId = invite.organizationId;

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

  // Best-effort: the membership exists by now, so a notice the SMTP server refuses must not leave the used
  // invite behind.
  try {
    await sendInviteAcceptedEmail(
      invite.creator.name ?? "",
      user.name,
      invite.creator.email,
      invite.creator.locale,
      user.id,
      invite.organizationId
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to send invite accepted email");
  }
  await deleteInvite(invite.id);
}

/** Create the user's own organization and workspace, when multi-org is on. */
async function handleOrganizationCreation(user: TCreatedUser, trail: TProvisioningTrail): Promise<void> {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) return;

  const organization = await createOrganization({ name: `${user.name}'s Organization` });
  trail.organizationId = organization.id;

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

  // The organization was created just above and owns no workspaces, so there is no cap to enforce.
  const workspace = await createWorkspace(
    organization.id,
    { name: DEFAULT_WORKSPACE_NAME },
    { workspaceLimit: null }
  );

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
  { user }: Extract<TSignUpOutcome, { status: "created" }>,
  inviteToken: string | undefined,
  trail: TProvisioningTrail
): Promise<void> {
  // Better Auth sends the verification email itself during signUpEmail (sendOnSignUp) — no manual
  // send here. The legacy EMAIL_VERIFICATION_DISABLED branch (ENG-1527) is folded into auth.ts'
  // requireEmailVerification config and the callbackURL chosen in signUpUserSafely.
  if (inviteToken) {
    await handleInviteAcceptance(inviteToken, user, trail);
    return;
  }
  await handleOrganizationCreation(user, trail);
}

/**
 * The two sign-up gates that used to live only in `signup/page.tsx`, enforced here so a direct POST
 * cannot walk around them.
 *
 * Returns WHICH grant admitted the sign-up, because the two are not interchangeable downstream: only
 * the fresh-instance exception is single-use, and `user.create.before` needs to know that to stamp the
 * bootstrap marker (ENG-2247).
 */
async function assertSignupPolicyAllows(
  inviteToken: string | undefined,
  inviteMatch: InviteMatch,
  setupToken: string | undefined
): Promise<{ isBootstrapAdmin: boolean }> {
  // A supplied-but-unusable invite is rejected before the user row is created, so a bad token can't
  // leave an orphaned account behind (handleInviteAcceptance would otherwise throw after signup).
  if (inviteToken && inviteMatch !== "valid") {
    logger.warn({ inviteMatch }, "Rejected sign-up with an unusable invite token");
    throw new InvalidInputError(INVITE_TOKEN_INVALID_ERROR_CODE);
  }

  // A valid invite is an independent grant — it admits the holder whatever the instance policy says.
  // Never the bootstrap administrator, even on an empty instance: the grant is the invite, not the
  // exception, and spending the single-use marker here would lock out the operator it is reserved for.
  if (inviteMatch === "valid") {
    return { isBootstrapAdmin: false };
  }

  // No invite, so it comes down to instance policy: public sign-up genuinely open, or the initial
  // administrator during fresh-instance setup, who has no invite to present. That predicate is shared
  // with the Better Auth hooks (signup-policy.ts) — writing it out twice is what left Better Auth's
  // native /sign-up/email open after this flow was fixed (ENG-2073 → ENG-2293).
  const admission = await resolveUninvitedSignupAdmission(setupToken);
  if (admission === "denied") {
    logClosedSignupRejection("sign-up-route");
    throw new InvalidInputError(SIGNUP_DISABLED_ERROR_CODE);
  }
  // ENG-7313: the instance is fresh but `SETUP_TOKEN` is configured and was not presented correctly.
  // Reveals only what /setup/intro already shows (the instance is unclaimed). Logged like the closed-sign-up
  // refusals, so an operator who set the token because the instance is exposed can see guessing; never
  // with the token or the address.
  if (admission === "setup-token-invalid") {
    logger.warn(
      { layer: "sign-up-route", reason: SETUP_TOKEN_INVALID_ERROR_CODE },
      "Rejected a fresh-instance sign-up without the correct setup token"
    );
    throw new InvalidInputError(SETUP_TOKEN_INVALID_ERROR_CODE);
  }

  return { isBootstrapAdmin: admission === "fresh-instance" };
}

/**
 * Sign-up's checks that run before any account is written: Turnstile, the invite, the instance policy and
 * the Cloud email-domain block. Throws an `InvalidInputError` carrying the stable code the form maps.
 * Returns the normalized invite token and whether this is the bootstrap administrator.
 */
export async function assertSignupAdmissible(
  input: TSignupBody
): Promise<{ inviteToken: string | undefined; isBootstrapAdmin: boolean }> {
  await verifyTurnstileIfConfigured(input.turnstileToken);

  // Normalized once, up front, and used for every downstream decision. The sign-up form always sends
  // this field as `inviteToken ?? ""`, so an ordinary uninvited sign-up arrives with an empty string —
  // anything blank has to mean "no invite" everywhere, or the checks below disagree with
  // `handlePostUserCreation` about which path the request is on.
  const inviteToken = input.inviteToken?.trim() || undefined;
  const inviteMatch = await resolveInviteMatch(inviteToken, input.email);

  const { isBootstrapAdmin } = await assertSignupPolicyAllows(inviteToken, inviteMatch, input.setupToken);

  // Formbricks Cloud only: reject personal/free/disposable email domains before any user is created.
  // Invited users are exempt unless SIGNUP_DOMAIN_CHECK_ON_INVITES is enabled.
  if (await isSignupEmailDomainBlocked(input.email, async () => inviteMatch === "valid")) {
    throw new InvalidInputError(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
  }

  return { inviteToken, isBootstrapAdmin };
}

type TCompleteSignUpInput = {
  outcome: Extract<TSignUpOutcome, { status: "created" }>;
  inviteToken: string | undefined;
  userLocale: z.infer<typeof ZUserLocale> | undefined;
  subscribeToSecurityUpdates: boolean | undefined;
  subscribeToProductUpdates: boolean | undefined;
  attributionProperties: Record<string, unknown>;
  /** For the audit record, captured while the request was live. */
  requestMetadata: TAuditRequestMetadata;
  apiUrl: string | undefined;
};

/**
 * Everything a NEW account gets, run after the response (ENG-7094). None of it happens for an address
 * that already had an account, so any of it on the response path makes a free address answer slower
 * than a registered one: provisioning alone is several database round trips, and the mailing list is
 * an outside call.
 *
 * Never throws: nothing after the response would catch it, so every failure is logged instead. The
 * steps are independent and each has its own guard, so a failed provisioning still subscribes the user
 * and still records the account — as a failure, since the account was left without its organization.
 * Before ENG-7094 the same failure reached the browser as an error, but it offered no way out: a retry
 * resolves to `already_existed` and provisions nothing, so an account left without an organization
 * lands on organization setup at first sign-in.
 */
async function completeSignUp({
  outcome,
  inviteToken,
  userLocale,
  subscribeToSecurityUpdates,
  subscribeToProductUpdates,
  attributionProperties,
  requestMetadata,
  apiUrl,
}: TCompleteSignUpInput): Promise<void> {
  let user = outcome.user;

  // signUpEmail can't carry the chosen locale (not a Better Auth field), so apply it afterwards — only
  // for an account this request created. Applying it on the already-existed path would let an
  // anonymous caller rewrite an existing user's locale by POSTing their address at sign-up.
  if (userLocale && user.locale !== userLocale) {
    try {
      await updateUser(user.id, { locale: userLocale });
      user = { ...user, locale: userLocale };
    } catch (error) {
      logger.error({ err: error, userId: user.id }, "Failed to apply the sign-up locale");
    }
  }

  const trail: TProvisioningTrail = {};
  let provisioningFailed = false;
  try {
    await handlePostUserCreation({ ...outcome, user }, inviteToken, trail);
  } catch (error) {
    // `err`, not `error`: pino serializes an Error's message and stack only under `err`.
    logger.error({ err: error, userId: user.id }, "Sign-up provisioning failed after the response");
    provisioningFailed = true;
  }
  // Named by the trail even when a later step threw: the organization can exist regardless (ENG-7094).
  const organizationId = trail.organizationId;

  // The audit record comes before the mailing list and analytics: an account that exists must be
  // recorded even if an outside call below hangs or the process stops, and a failed provisioning is
  // a failure record, as the route wrapper wrote before this work moved after the response (ENG-2091).
  // The actor is unknown, as in the route's own entry this replaces: the caller has no session.
  await queueAuditEventWithoutRequest({
    action: "created",
    targetType: "user",
    userId: UNKNOWN_DATA,
    userType: "user",
    targetId: user.id,
    organizationId: organizationId ?? UNKNOWN_DATA,
    status: provisioningFailed ? "failure" : "success",
    newObject: user,
    apiUrl,
    requestMetadata,
  }).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, "Failed to record the sign-up audit event");
  });

  try {
    await subscribeUserToMailingList({
      email: user.email,
      isFormbricksCloud: IS_FORMBRICKS_CLOUD,
      subscribeToSecurityUpdates,
      subscribeToProductUpdates,
    });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "Mailing-list subscription failed after sign-up");
  }

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
      invite_organization_id: inviteToken ? (organizationId ?? null) : null,
    },
    organizationId ? { organizationId } : undefined
  );
}

/**
 * Set the sign-up intent cookie on EVERY successful sign-up, created or not (ENG-7094).
 *
 * Only a created account gets a cookie that names it (ENG-2562). A cookie on the `created` path alone
 * answered "is this address free?" in one request, by its `Set-Cookie`. So `already_existed` gets a
 * decoy of the same shape, naming no account (`createDecoySignupIntentToken`). It never passes
 * `classifySignupIntent`, so it hands the caller nothing, and the signed, encrypted value does not show
 * which kind it is.
 *
 * Always a fresh decoy, even when the browser holds a valid cookie. Carrying that cookie's account over
 * would let a caller spend the result on the resend route, which refreshes only a cookie valid for its
 * account, and learn which path ran. The cost is the rare double submit of one sign-up: its second
 * request replaces the first one's cookie, and that browser signs in by hand after verifying.
 *
 * Non-fatal: the cookie buys UX (auto-sign-in after verification), so a failure to mint it must cost
 * exactly that UX — never the sign-up itself, which has already created the account. Concretely
 * reachable when neither secret is set, and then on both paths alike.
 */
async function issueSignupIntentCookie(outcome: TSignUpOutcome): Promise<void> {
  try {
    const value =
      outcome.status === "created"
        ? createSignupIntentToken(outcome.user.id)
        : createDecoySignupIntentToken();
    (await cookies()).set(SIGNUP_INTENT_COOKIE_NAME, value, SIGNUP_INTENT_COOKIE_OPTIONS);
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to issue the sign-up intent cookie; verification will require a manual sign-in"
    );
  }
}

/**
 * Create the credential account after `assertSignupAdmissible` let the request through, and schedule
 * its provisioning for after the response.
 *
 * Until the response, both outcomes do the same work, so neither the answer nor how long it takes says
 * whether the address already had an account (ENG-2099, ENG-7094). The one difference left is inside
 * Better Auth's signUpEmail: a creation inserts the user and its credential account, a few milliseconds
 * against the jitter of the password hash both paths run. The `created` audit record is written after
 * the response too, once the organization it belongs to exists; the route records nothing itself on
 * success.
 */
export async function createSignup(
  input: TSignupBody,
  { inviteToken, isBootstrapAdmin }: { inviteToken: string | undefined; isBootstrapAdmin: boolean },
  { apiUrl }: { apiUrl?: string } = {}
): Promise<void> {
  // The domain policy passed, so mark the request scope: user.create.before uses this to tell a
  // sign-up that went through this flow apart from any other caller of Better Auth's native
  // /sign-up/email endpoint, which the hook re-checks. That endpoint is closed over HTTP (ENG-3988).
  const outcome = await runWithSignupRequestContext(() => {
    markSignupDomainAllowed();
    // ENG-2247: carried into user.create.before, which stamps the marker on the row it inserts. The
    // unique index on that column is what makes two concurrent fresh-instance sign-ups resolve to one.
    if (isBootstrapAdmin) markBootstrapAdminSignup();
    return signUpUserSafely(input.email, input.name, input.password);
  });

  // ENG-7313: the instance is set up from the moment its first user exists, not from the first page
  // that happens to ask. Written before the response so a first user who deletes their account before
  // the next request cannot re-arm the setup. Not fatal: the account is already created, and
  // getIsFreshInstance writes the marker too once it sees a user.
  if (outcome.status === "created" && isBootstrapAdmin) {
    try {
      await markInstanceSetupCompleted();
    } catch (error) {
      logger.error({ err: error, userId: outcome.user.id }, "Failed to record that the instance is set up");
    }
  }

  await issueSignupIntentCookie(outcome);

  // Read while the request is live, and cleared on both paths alike: the marketing first-touch cookie
  // is consumed by this sign-up attempt whatever its outcome. Clearing it only for a created account
  // would put a `Set-Cookie` on that path alone.
  const cookieStore = await cookies();
  const attributionProperties = getAttributionPropertiesFromCookies(cookieStore);
  if (cookieStore.get(ATTRIBUTION_COOKIE_NAME) !== undefined) {
    try {
      cookieStore.delete(ATTRIBUTION_COOKIE_NAME);
    } catch {
      // Best-effort; the short cookie lifetime is the backstop.
    }
  }

  // Captured on BOTH outcomes, while the request is live: the header read must not be an extra step
  // only a created account pays, or it becomes the timing difference the rest of this function
  // removes (ENG-7094). Only the `created` path uses it.
  const requestMetadata = AUDIT_LOG_ENABLED
    ? await getAuditRequestMetadata()
    : UNKNOWN_AUDIT_REQUEST_METADATA;

  // Provisioning + analytics for a NEW account only. Nothing runs on `already_existed`: this endpoint
  // is unauthenticated, so the caller has proven nothing about an account that already exists
  // (ENG-2091).
  if (outcome.status !== "created") return;

  const completion: TCompleteSignUpInput = {
    outcome,
    inviteToken,
    userLocale: input.userLocale,
    subscribeToSecurityUpdates: input.subscribeToSecurityUpdates,
    subscribeToProductUpdates: input.subscribeToProductUpdates,
    attributionProperties,
    requestMetadata,
    apiUrl,
  };
  after(() => completeSignUp(completion));
}
