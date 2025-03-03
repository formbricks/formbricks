"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { deleteFile } from "@formbricks/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@formbricks/lib/storage/utils";
import { updateUser } from "@formbricks/lib/user/service";
import { ZId } from "@formbricks/types/common";
import { ZUserUpdateInput } from "@formbricks/types/user";

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
