"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import {
  InvalidInputError,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
  UnknownError,
} from "@formbricks/types/errors";
import { ZUser, ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD, IS_TURNSTILE_CONFIGURED, TURNSTILE_SECRET_KEY } from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createOrganization, getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog, identifyPostHogPerson } from "@/lib/posthog";
import { getUserByEmail } from "@/lib/user/service";
import { actionClient } from "@/lib/utils/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { ATTRIBUTION_COOKIE_NAME, getAttributionPropertiesFromCookies } from "@/modules/auth/lib/attribution";
import { auth } from "@/modules/auth/lib/auth";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import {
  markSignupDomainAllowed,
  runWithSignupRequestContext,
} from "@/modules/auth/lib/signup-request-context";
import { updateUser } from "@/modules/auth/lib/user";
import { deleteInvite, getInvite, resolveInviteMatch } from "@/modules/auth/signup/lib/invite";
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

const ZCreateUserAction = z.object({
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
});

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

async function signUpUserSafely(
  email: string,
  name: string,
  password: string,
  userLocale: z.infer<typeof ZUserLocale> | undefined
): Promise<{ user: TCreatedUser | undefined; userAlreadyExisted: boolean }> {
  const normalizedEmail = email.toLowerCase();

  try {
    // Better Auth-native signup: creates the User + a bcrypt credential Account (via the password hook
    // in auth.ts) and, when verification is enabled, sends Better Auth's verification email (sendOnSignUp;
    // callbackURL defaults to "/"). We deliberately do NOT pass a /invite callbackURL for invite signups:
    // the invite is accepted and deleted in handlePostUserCreation right after this, so by the time the
    // verification link is clicked /invite would render "Invite Not Found" (ENG-1527) — the verified,
    // already-provisioned user lands on the app home instead. Replaces the manual hash + createUser + the
    // legacy verification-token email.
    await auth.api.signUpEmail({ body: { email: normalizedEmail, password, name } });
  } catch (error) {
    // Enumeration-safe: a duplicate email resolves to "already existed", not a surfaced error.
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return { user: existing, userAlreadyExisted: true };
    }
    throw error;
  }

  let user = await getUserByEmail(normalizedEmail);
  if (!user) {
    // signUpEmail succeeded but the row can't be loaded — an invariant violation. Fail loud rather
    // than returning { success: true } with no user, which would skip org creation / invite acceptance.
    throw new UnknownError("Failed to load user after signup");
  }
  // signUpEmail can't carry the chosen locale (not a Better Auth field), so apply it afterwards.
  if (userLocale && user.locale !== userLocale) {
    await updateUser(user.id, { locale: userLocale });
    user = { ...user, locale: userLocale };
  }

  return { user, userAlreadyExisted: false };
}

async function handleInviteAcceptance(
  ctx: ActionClientCtx,
  inviteToken: string,
  user: TCreatedUser
): Promise<void> {
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
      groupIdentifyPostHog("organization", invitedOrganization.id, { name: invitedOrganization.name });
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

  groupIdentifyPostHog("organization", organization.id, { name: organization.name });
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

async function handlePostUserCreation(
  ctx: ActionClientCtx,
  user: TCreatedUser,
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

export const createUserAction = actionClient.inputSchema(ZCreateUserAction).action(
  withAuditLogging("created", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.signup);
    await verifyTurnstileIfConfigured(parsedInput.turnstileToken);

    // Formbricks Cloud only: reject personal/free/disposable email domains before any user is created.
    // Invited users are exempt unless SIGNUP_DOMAIN_CHECK_ON_INVITES is enabled.
    if (
      await isSignupEmailDomainBlocked(
        parsedInput.email,
        async () => (await resolveInviteMatch(parsedInput.inviteToken, parsedInput.email)) === "valid"
      )
    ) {
      throw new InvalidInputError(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    }

    // The domain policy passed, so mark the request scope: user.create.before uses this to tell a
    // sign-up that went through this action apart from a direct POST to Better Auth's native
    // /sign-up/email endpoint (which bypasses the action and is re-checked in the hook).
    const { user, userAlreadyExisted } = await runWithSignupRequestContext(() => {
      markSignupDomainAllowed();
      return signUpUserSafely(
        parsedInput.email,
        parsedInput.name,
        parsedInput.password,
        parsedInput.userLocale
      );
    });

    if (!userAlreadyExisted && user) {
      await handlePostUserCreation(ctx, user, parsedInput.inviteToken);

      await subscribeUserToMailingList({
        email: user.email,
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        subscribeToSecurityUpdates: parsedInput.subscribeToSecurityUpdates,
        subscribeToProductUpdates: parsedInput.subscribeToProductUpdates,
      });

      const cookieStore = await cookies();
      const hasAttributionCookie = cookieStore.get(ATTRIBUTION_COOKIE_NAME) !== undefined;
      const attributionProperties = getAttributionPropertiesFromCookies(cookieStore);

      identifyPostHogPerson(user.id, { email: user.email, name: user.name });
      capturePostHogEvent(
        user.id,
        "user_signed_up",
        {
          // Spread attribution first so trusted, server-computed props always win on a name clash.
          ...attributionProperties,
          auth_provider: "credentials",
          email_domain: user.email.split("@")[1],
          signup_source: parsedInput.inviteToken ? "invite" : "direct",
          invite_organization_id: ctx.auditLoggingCtx.organizationId ?? null,
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
    }

    if (user) {
      ctx.auditLoggingCtx.userId = user.id;
      ctx.auditLoggingCtx.newObject = user;
    }

    return {
      success: true,
    };
  })
);
