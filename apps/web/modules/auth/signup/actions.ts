"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { InvalidInputError, UnknownError } from "@formbricks/types/errors";
import { ZUser, ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { hashPassword } from "@/lib/auth";
import {
  IS_FORMBRICKS_CLOUD,
  IS_TURNSTILE_CONFIGURED,
  TURNSTILE_SECRET_KEY,
  WEBAPP_URL,
} from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createOrganization, getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { actionClient } from "@/lib/utils/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { createUser, updateUser } from "@/modules/auth/lib/user";
import { deleteInvite, getInvite } from "@/modules/auth/signup/lib/invite";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { verifyTurnstileToken } from "@/modules/auth/signup/lib/utils";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/modules/email";

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
  emailVerificationDisabled: z.boolean().optional(),
  turnstileToken: z
    .string()
    .optional()
    .refine(
      (token) => !IS_TURNSTILE_CONFIGURED || (IS_TURNSTILE_CONFIGURED && token),
      "CAPTCHA verification required"
    ),
  isFormbricksCloud: z.boolean(),
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

async function createUserSafely(
  email: string,
  name: string,
  hashedPassword: string,
  userLocale: z.infer<typeof ZUserLocale> | undefined
): Promise<{ user: TCreatedUser | undefined; userAlreadyExisted: boolean }> {
  let user: TCreatedUser | undefined = undefined;
  let userAlreadyExisted = false;

  try {
    user = await createUser({
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      locale: userLocale,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      userAlreadyExisted = true;
    } else {
      throw error;
    }
  }

  return { user, userAlreadyExisted };
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

  groupIdentifyPostHog("organization", organization.id, { name: organization.name });

  capturePostHogEvent(
    user.id,
    "organization_created",
    {
      organization_id: organization.id,
      is_first_org: true,
    },
    { organizationId: organization.id }
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
  inviteToken: string | undefined,
  emailVerificationDisabled: boolean | undefined
): Promise<void> {
  if (inviteToken) {
    await handleInviteAcceptance(ctx, inviteToken, user);
  } else {
    await handleOrganizationCreation(ctx, user);
  }

  if (!emailVerificationDisabled) {
    let inviteCallbackUrl: string | undefined;

    if (inviteToken) {
      const inviteUrl = new URL("/invite", WEBAPP_URL);
      inviteUrl.searchParams.set("token", inviteToken);
      inviteCallbackUrl = inviteUrl.toString();
    }

    await sendVerificationEmail({
      id: user.id,
      email: user.email,
      locale: user.locale,
      callbackUrl: inviteCallbackUrl,
    });
  }
}

export const createUserAction = actionClient.inputSchema(ZCreateUserAction).action(
  withAuditLogging("created", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.signup);
    await verifyTurnstileIfConfigured(parsedInput.turnstileToken);

    const hashedPassword = await hashPassword(parsedInput.password);
    const { user, userAlreadyExisted } = await createUserSafely(
      parsedInput.email,
      parsedInput.name,
      hashedPassword,
      parsedInput.userLocale
    );

    if (!userAlreadyExisted && user) {
      await handlePostUserCreation(ctx, user, parsedInput.inviteToken, parsedInput.emailVerificationDisabled);

      await subscribeUserToMailingList({
        email: user.email,
        isFormbricksCloud: parsedInput.isFormbricksCloud,
        subscribeToSecurityUpdates: parsedInput.subscribeToSecurityUpdates,
        subscribeToProductUpdates: parsedInput.subscribeToProductUpdates,
      });

      capturePostHogEvent(
        user.id,
        "user_signed_up",
        {
          auth_provider: "credentials",
          email_domain: user.email.split("@")[1],
          signup_source: parsedInput.inviteToken ? "invite" : "direct",
          invite_organization_id: ctx.auditLoggingCtx.organizationId ?? null,
        },
        ctx.auditLoggingCtx.organizationId
          ? { organizationId: ctx.auditLoggingCtx.organizationId }
          : undefined
      );
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
