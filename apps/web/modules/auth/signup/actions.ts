"use server";

import { hashPassword } from "@/lib/auth";
import { IS_TURNSTILE_CONFIGURED, TURNSTILE_SECRET_KEY } from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { actionClient } from "@/lib/utils/action-client";
import { createUser, updateUser } from "@/modules/auth/lib/user";
import { deleteInvite, getInvite } from "@/modules/auth/signup/lib/invite";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import { captureFailedSignup, verifyTurnstileToken } from "@/modules/auth/signup/lib/utils";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/modules/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InvalidInputError, UnknownError } from "@formbricks/types/errors";
import { ZUser, ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";

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
});

async function verifyTurnstileIfConfigured(
  turnstileToken: string | undefined,
  email: string,
  name: string
): Promise<void> {
  if (!IS_TURNSTILE_CONFIGURED) return;

  if (!turnstileToken || !TURNSTILE_SECRET_KEY) {
    captureFailedSignup(email, name);
    throw new UnknownError("Server configuration error");
  }

  const isHuman = await verifyTurnstileToken(TURNSTILE_SECRET_KEY, turnstileToken);
  if (!isHuman) {
    captureFailedSignup(email, name);
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
    if (error instanceof InvalidInputError && error.message === "User with this email already exists") {
      userAlreadyExisted = true;
    } else {
      throw error;
    }
  }

  return { user, userAlreadyExisted };
}

async function handleInviteAcceptance(inviteToken: string, user: TCreatedUser): Promise<void> {
  const inviteTokenData = verifyInviteToken(inviteToken);
  const invite = await getInvite(inviteTokenData.inviteId);

  if (!invite) {
    throw new Error("Invalid invite ID");
  }

  await createMembership(invite.organizationId, user.id, {
    accepted: true,
    role: invite.role,
  });

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
      weeklySummary: {},
      unsubscribedOrganizationIds: [invite.organizationId],
    },
  });

  await sendInviteAcceptedEmail(invite.creator.name ?? "", user.name, invite.creator.email);
  await deleteInvite(invite.id);
}

async function handleOrganizationCreation(user: TCreatedUser): Promise<void> {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) return;

  const organization = await createOrganization({ name: `${user.name}'s Organization` });

  await createMembership(organization.id, user.id, {
    role: "owner",
    accepted: true,
  });

  await updateUser(user.id, {
    notificationSettings: {
      ...user.notificationSettings,
      alert: { ...user.notificationSettings?.alert },
      weeklySummary: { ...user.notificationSettings?.weeklySummary },
      unsubscribedOrganizationIds: Array.from(
        new Set([...(user.notificationSettings?.unsubscribedOrganizationIds ?? []), organization.id])
      ),
    },
  });
}

async function handlePostUserCreation(
  user: TCreatedUser,
  inviteToken: string | undefined,
  emailVerificationDisabled: boolean | undefined
): Promise<void> {
  if (inviteToken) {
    await handleInviteAcceptance(inviteToken, user);
  } else {
    await handleOrganizationCreation(user);
  }

  if (!emailVerificationDisabled) {
    await sendVerificationEmail(user);
  }
}

export const createUserAction = actionClient.schema(ZCreateUserAction).action(async ({ parsedInput }) => {
  await verifyTurnstileIfConfigured(parsedInput.turnstileToken, parsedInput.email, parsedInput.name);

  const hashedPassword = await hashPassword(parsedInput.password);
  const { user, userAlreadyExisted } = await createUserSafely(
    parsedInput.email,
    parsedInput.name,
    hashedPassword,
    parsedInput.userLocale
  );

  if (!userAlreadyExisted && user) {
    await handlePostUserCreation(user, parsedInput.inviteToken, parsedInput.emailVerificationDisabled);
  }

  revalidatePath("/auth/signup");

  return {
    success: true,
    message: "If this email is already registered, we'll send you a confirmation.",
  };
});
