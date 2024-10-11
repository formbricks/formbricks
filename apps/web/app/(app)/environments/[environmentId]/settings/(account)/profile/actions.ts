"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "@formbricks/lib/auth/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
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

const ZSetupTwoFactorAuthAction = z.object({
  password: z.string(),
});

export const setupTwoFactorAuthAction = authenticatedActionClient
  .schema(ZSetupTwoFactorAuthAction)
  .action(async ({ parsedInput, ctx }) => {
    return await setupTwoFactorAuth(ctx.user.id, parsedInput.password);
  });

const ZEnableTwoFactorAuthAction = z.object({
  code: z.string(),
});

export const enableTwoFactorAuthAction = authenticatedActionClient
  .schema(ZEnableTwoFactorAuthAction)
  .action(async ({ parsedInput, ctx }) => {
    return await enableTwoFactorAuth(ctx.user.id, parsedInput.code);
  });

const ZDisableTwoFactorAuthAction = z.object({
  code: z.string(),
  password: z.string(),
  backupCode: z.string().optional(),
});

export const disableTwoFactorAuthAction = authenticatedActionClient
  .schema(ZDisableTwoFactorAuthAction)
  .action(async ({ parsedInput, ctx }) => {
    return await disableTwoFactorAuth(ctx.user.id, parsedInput);
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

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
