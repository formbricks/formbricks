"use server";

import {
  getIsEmailUnique,
  verifyUserPassword,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/lib/user";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { deleteFile } from "@/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@/lib/storage/utils";
import { getUser, updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { rateLimit } from "@/lib/utils/rate-limit";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendForgotPasswordEmail, sendVerificationNewEmail } from "@/modules/email";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { TUserUpdateInput, ZUserPassword, ZUserUpdateInput } from "@formbricks/types/user";

const limiter = rateLimit({
  interval: 60 * 60, // 1 hour
  allowedPerInterval: 3, // max 3 calls for email verification per hour
});

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
  ctx: any;
  parsedInput: any;
  payload: TUserUpdateInput;
}) {
  const inputEmail = parsedInput.email?.trim().toLowerCase();
  if (!inputEmail || ctx.user.email === inputEmail) return payload;

  try {
    await limiter(ctx.user.id);
  } catch {
    throw new TooManyRequestsError("Too many requests");
  }
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

export const updateUserAction = authenticatedActionClient
  .schema(
    ZUserUpdateInput.pick({ name: true, email: true, locale: true }).extend({
      password: ZUserPassword.optional(),
    })
  )
  .action(
    withAuditLogging(
      "updated",
      "user",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
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

const ZUpdateAvatarAction = z.object({
  avatarUrl: z.string(),
});

export const updateAvatarAction = authenticatedActionClient.schema(ZUpdateAvatarAction).action(
  withAuditLogging(
    "updated",
    "user",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const oldObject = await getUser(ctx.user.id);
      const result = await updateUser(ctx.user.id, { imageUrl: parsedInput.avatarUrl });
      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZRemoveAvatarAction = z.object({
  environmentId: ZId,
});

export const removeAvatarAction = authenticatedActionClient.schema(ZRemoveAvatarAction).action(
  withAuditLogging(
    "updated",
    "user",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const oldObject = await getUser(ctx.user.id);
      const imageUrl = ctx.user.imageUrl;
      if (!imageUrl) {
        throw new Error("Image not found");
      }

      const fileName = getFileNameWithIdFromUrl(imageUrl);
      if (!fileName) {
        throw new Error("Invalid filename");
      }

      const deletionResult = await deleteFile(parsedInput.environmentId, "public", fileName);
      if (!deletionResult.success) {
        throw new Error("Deletion failed");
      }
      const result = await updateUser(ctx.user.id, { imageUrl: null });
      ctx.auditLoggingCtx.userId = ctx.user.id;
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

export const resetPasswordAction = authenticatedActionClient.action(async ({ ctx }) => {
  if (ctx.user.identityProvider !== "email") {
    throw new OperationNotAllowedError("Password reset is not allowed for SSO users");
  }

  await sendForgotPasswordEmail(ctx.user);

  return { success: true };
});
