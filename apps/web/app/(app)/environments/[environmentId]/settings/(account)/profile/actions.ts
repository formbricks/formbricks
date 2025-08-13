"use server";

import {
  getIsEmailUnique,
  verifyUserPassword,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/lib/user";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { getUser, updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendForgotPasswordEmail, sendVerificationNewEmail } from "@/modules/email";
import { AuthenticationError, AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import {
  TUserPersonalInfoUpdateInput,
  TUserUpdateInput,
  ZUserPersonalInfoUpdateInput,
} from "@formbricks/types/user";

function buildUserUpdatePayload(parsedInput: any): TUserUpdateInput {
  return {
    ...(parsedInput.name && { name: parsedInput.name }),
    ...(parsedInput.locale && { locale: parsedInput.locale }),
  };
}

async function handleEmailUpdate({
  ctx,
  parsedInput,
  payload,
}: {
  ctx: AuthenticatedActionClientCtx;
  parsedInput: TUserPersonalInfoUpdateInput;
  payload: TUserUpdateInput;
}) {
  const inputEmail = parsedInput.email?.trim().toLowerCase();
  if (!inputEmail || ctx.user.email === inputEmail) return payload;

  await applyRateLimit(rateLimitConfigs.actions.emailUpdate, ctx.user.id);

  if (ctx.user.identityProvider !== "email") {
    throw new OperationNotAllowedError("Email update is not allowed for non-credential users.");
  }
  if (!parsedInput.password) {
    throw new AuthenticationError("Password is required to update email.");
  }
  const isCorrectPassword = await verifyUserPassword(ctx.user.id, parsedInput.password);
  if (!isCorrectPassword) {
    throw new AuthorizationError("Incorrect credentials");
  }
  const isEmailUnique = await getIsEmailUnique(inputEmail);
  if (!isEmailUnique) return payload;

  if (EMAIL_VERIFICATION_DISABLED) {
    payload.email = inputEmail;
    await updateBrevoCustomer({ id: ctx.user.id, email: inputEmail });
  } else {
    await sendVerificationNewEmail(ctx.user.id, inputEmail);
  }
  return payload;
}

export const updateUserAction = authenticatedActionClient.schema(ZUserPersonalInfoUpdateInput).action(
  withAuditLogging(
    "updated",
    "user",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: TUserPersonalInfoUpdateInput;
    }) => {
      const oldObject = await getUser(ctx.user.id);
      let payload = buildUserUpdatePayload(parsedInput);
      payload = await handleEmailUpdate({ ctx, parsedInput, payload });

      // Only proceed with updateUser if we have actual changes to make
      let newObject = oldObject;
      if (Object.keys(payload).length > 0) {
        newObject = await updateUser(ctx.user.id, payload);
      }

      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = newObject;

      return true;
    }
  )
);

export const resetPasswordAction = authenticatedActionClient.action(
  withAuditLogging(
    "passwordReset",
    "user",
    async ({ ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: undefined }) => {
      if (ctx.user.identityProvider !== "email") {
        throw new OperationNotAllowedError("Password reset is not allowed for this user.");
      }

      await sendForgotPasswordEmail(ctx.user);

      ctx.auditLoggingCtx.userId = ctx.user.id;

      return { success: true };
    }
  )
);
