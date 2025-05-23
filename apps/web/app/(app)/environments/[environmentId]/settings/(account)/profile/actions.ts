"use server";

import {
  checkUserExistsByEmail,
  verifyUserPassword,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/lib/user";
import { EMAIL_VERIFICATION_DISABLED } from "@/lib/constants";
import { deleteFile } from "@/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@/lib/storage/utils";
import { updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { rateLimit } from "@/lib/utils/rate-limit";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { sendVerificationNewEmail } from "@/modules/email";
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

export const updateUserAction = authenticatedActionClient
  .schema(
    ZUserUpdateInput.pick({ name: true, email: true, locale: true }).extend({
      password: ZUserPassword.optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const inputEmail = parsedInput.email?.trim().toLowerCase();

    let payload: TUserUpdateInput = {
      name: parsedInput.name,
      locale: parsedInput.locale,
    };

    if (inputEmail && ctx.user.email !== inputEmail) {
      // Check rate limit
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

      const doesUserExist = await checkUserExistsByEmail(inputEmail);

      if (!doesUserExist) {
        if (EMAIL_VERIFICATION_DISABLED) {
          payload.email = inputEmail;
          updateBrevoCustomer({ id: ctx.user.id, email: inputEmail });
        } else {
          await sendVerificationNewEmail(ctx.user.id, inputEmail);
        }
      }
    }

    return await updateUser(ctx.user.id, payload);
  });

const ZUpdateAvatarAction = z.object({
  avatarUrl: z.string(),
});

export const updateAvatarAction = authenticatedActionClient
  .schema(ZUpdateAvatarAction)
  .action(async ({ parsedInput, ctx }) => {
    return await updateUser(ctx.user.id, { imageUrl: parsedInput.avatarUrl });
  });

const ZRemoveAvatarAction = z.object({
  environmentId: ZId,
});

export const removeAvatarAction = authenticatedActionClient
  .schema(ZRemoveAvatarAction)
  .action(async ({ parsedInput, ctx }) => {
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
    return await updateUser(ctx.user.id, { imageUrl: null });
  });
