"use server";

import { getServerSession } from "next-auth";

import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "@formbricks/lib/auth/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { deleteFile } from "@formbricks/lib/storage/service";
import { getFileNameWithIdFromUrl } from "@formbricks/lib/storage/utils";
import { deleteUser, updateUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TUserUpdateInput } from "@formbricks/types/user";

export const updateUserAction = async (data: Partial<TUserUpdateInput>) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await updateUser(session.user.id, data);
};

export const deleteUserAction = async () => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await deleteUser(session.user.id);
};

export const setupTwoFactorAuthAction = async (password: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await setupTwoFactorAuth(session.user.id, password);
};

export const enableTwoFactorAuthAction = async (code: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await enableTwoFactorAuth(session.user.id, code);
};

type TDisableTwoFactorAuthParams = {
  code: string;
  password: string;
  backupCode?: string;
};

export const disableTwoFactorAuthAction = async (params: TDisableTwoFactorAuthParams) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await disableTwoFactorAuth(session.user.id, params);
};

export const updateAvatarAction = async (avatarUrl: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await updateUser(session.user.id, { imageUrl: avatarUrl });
};

export const removeAvatarAction = async (environmentId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isUserAuthorized) {
    throw new Error("Not Authorized");
  }

  try {
    const imageUrl = session.user.imageUrl;
    if (!imageUrl) {
      throw new Error("Image not found");
    }

    const fileName = getFileNameWithIdFromUrl(imageUrl);
    if (!fileName) {
      throw new Error("Invalid filename");
    }

    const deletionResult = await deleteFile(environmentId, "public", fileName);
    if (!deletionResult.success) {
      throw new Error("Deletion failed");
    }
    return await updateUser(session.user.id, { imageUrl: null });
  } catch (error) {
    throw new Error(`${"Deletion failed"}: ${error.message}`);
  }
};
