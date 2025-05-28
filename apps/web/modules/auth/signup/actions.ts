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
import { ZUserEmail, ZUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";

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

export const createUserAction = actionClient.schema(ZCreateUserAction).action(async ({ parsedInput }) => {
  if (IS_TURNSTILE_CONFIGURED) {
    if (!parsedInput.turnstileToken || !TURNSTILE_SECRET_KEY) {
      captureFailedSignup(parsedInput.email, parsedInput.name);
      throw new UnknownError("Server configuration error");
    }

    const isHuman = await verifyTurnstileToken(TURNSTILE_SECRET_KEY, parsedInput.turnstileToken);
    if (!isHuman) {
      captureFailedSignup(parsedInput.email, parsedInput.name);
      throw new UnknownError("reCAPTCHA verification failed");
    }
  }

  const { inviteToken, emailVerificationDisabled } = parsedInput;
  const hashedPassword = await hashPassword(parsedInput.password);
  let user;
  let userAlreadyExisted = false;

  try {
    user = await createUser({
      email: parsedInput.email.toLowerCase(),
      name: parsedInput.name,
      password: hashedPassword,
      locale: parsedInput.userLocale,
    });
  } catch (error) {
    if (error instanceof InvalidInputError && error.message === "User with this email already exists") {
      userAlreadyExisted = true;
    } else {
      throw error;
    }
  }

  if (!userAlreadyExisted && user) {
    if (inviteToken) {
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
    } else {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (isMultiOrgEnabled) {
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
              new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
            ),
          },
        });
      }
    }

    if (!emailVerificationDisabled) {
      await sendVerificationEmail(user);
    }
  }

  revalidatePath("/auth/signup");

  return {
    success: true,
    message: "If this email is already registered, we'll send you a confirmation.",
  };
});
