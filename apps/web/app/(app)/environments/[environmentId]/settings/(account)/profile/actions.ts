"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
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

const ZUpdateCommunityAvatarAction = z.object({
  communityAvatarUrl: z.string(),
});

export const updateCommunityAvatarAction = authenticatedActionClient
  .schema(ZUpdateCommunityAvatarAction)
  .action(async ({ parsedInput, ctx }) => {
    return await updateUser(ctx.user.id, { communityAvatarUrl: parsedInput.communityAvatarUrl });
  });

const ZRemoveCommunityAvatarAction = z.object({
  environmentId: ZId,
});

export const removeCommunityAvatarAction = authenticatedActionClient
  .schema(ZRemoveCommunityAvatarAction)
  .action(async ({ parsedInput, ctx }) => {
    const communityAvatarUrl = ctx.user.communityAvatarUrl;
    if (!communityAvatarUrl) {
      throw new Error("Image not found");
    }

    const fileName = getFileNameWithIdFromUrl(communityAvatarUrl);
    if (!fileName) {
      throw new Error("Invalid filename");
    }

    const deletionResult = await deleteFile(parsedInput.environmentId, "public", fileName);
    if (!deletionResult.success) {
      throw new Error("Deletion failed");
    }
    return await updateUser(ctx.user.id, { communityAvatarUrl: null });
  });

const ZConnectSocialAccountAction = z.object({
  provider: z.string(),
  socialId: z.string(),
  socialName: z.string(),
  socialEmail: z.string(),
  socialAvatar: z.string().nullable(),
});

export const connectSocialAccountAction = authenticatedActionClient
  .schema(ZConnectSocialAccountAction)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;
    const { provider, socialId, socialName, socialEmail, socialAvatar } = parsedInput;

    try {
      const existingAccount = await prisma.userSocial.findFirst({
        where: {
          userId,
          provider,
        },
      });

      if (existingAccount) {
        return await prisma.userSocial.update({
          where: {
            id: existingAccount.id,
          },
          data: {
            socialId,
            socialName,
            socialEmail,
            socialAvatar,
          },
        });
      } else {
        return await prisma.userSocial.create({
          data: {
            userId,
            provider,
            socialId,
            socialName,
            socialEmail,
            socialAvatar,
          },
        });
      }
    } catch (error) {
      throw new Error(`Failed to connect ${provider} account: ${error.message}`);
    }
  });

const ZDisconnectSocialAccountAction = z.object({
  provider: z.string(),
});

export const disconnectSocialAccountAction = authenticatedActionClient
  .schema(ZDisconnectSocialAccountAction)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;
    const { provider } = parsedInput;

    try {
      const result = await prisma.userSocial.delete({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to disconnect ${provider} account: ${error.message}`);
    }
  });

export const getUserSocialAccountsAction = authenticatedActionClient.action(async ({ ctx }) => {
  const userId = ctx.user.id;

  try {
    return await prisma.userSocial.findMany({
      where: {
        userId,
      },
    });
  } catch (error) {
    throw new Error(`Failed to fetch social accounts: ${error.message}`);
  }
});
