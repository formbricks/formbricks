"use server";

import { deleteFile } from "@/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@/lib/storage/utils";
import { getUserByEmail, updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { sendVerificationNewEmail } from "@/modules/email";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";

export const updateUserAction = authenticatedActionClient
  .schema(ZUserUpdateInput.partial())
  .action(async ({ parsedInput, ctx }) => {
    return await updateUser(ctx.user.id, parsedInput);
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

const ZsendVerificationEmailAction = z.object({
  email: ZUserEmail,
});

export const sendVerificationNewEmailAction = authenticatedActionClient
  .schema(ZsendVerificationEmailAction)
  .action(async ({ parsedInput, ctx }) => {
    const { email } = parsedInput;

    const user = await getUserByEmail(email);

    if (ctx.user.email === email) {
     throw new Error("You cannot request verification for the same email.");
    }

    if (user && user.id !== ctx.user.id) {
      throw new Error("Email already belongs to another user.");
    }
    return await sendVerificationNewEmail(ctx.user.id, email);
  });
