"use server";

import { deleteFile } from "@/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@/lib/storage/utils";
import { getUserByEmail, updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { sendVerificationNewEmail } from "@/modules/email";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZUserEmail, ZUserUpdateInput } from "@formbricks/types/user";

export const updateUserAction = authenticatedActionClient
  .schema(ZUserUpdateInput.partial())
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.email && ctx.user.identityProvider !== "email") {
      throw new Error("Email update is not allowed for non-credential users.");
    }
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
    if (ctx.user.identityProvider !== "email") {
      throw new Error("Email verification is only available for users registered with email.");
    }
    const user = await getUserByEmail(email);

    if (ctx.user.email === email) {
     throw new Error("You cannot request verification for the same email.");
    }

    if (user && user.id !== ctx.user.id) {
      throw new Error("Email already belongs to another user.");
    }
    return await sendVerificationNewEmail(ctx.user.id, email);
  });

const ZchangePasswordAction = z.object({
  password: z.string().min(8),
});

export const comparePasswordsAction = authenticatedActionClient
  .schema(ZchangePasswordAction)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: ctx.user.email,
        },
      });
      if (!user) {
        throw new Error("No user found with this email");
      }

      if (!user.password) {
        throw new Error("User has no password set");
      }

      const isValid = await verifyPassword(parsedInput.password, user.password);

      if (!isValid) {
        throw new Error("Incorrect password");
      }

      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || "Internal server error. Please try again later.");
    }
  });
