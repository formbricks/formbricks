"use server";

import { getServerSession } from "next-auth";

import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "@formbricks/lib/auth/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { deleteFile } from "@formbricks/lib/storage/service";
import { deleteUser, updateUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TUserUpdateInput } from "@formbricks/types/user";

export async function updateUserAction(data: Partial<TUserUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await updateUser(session.user.id, data);
}

export async function deleteUserAction() {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await deleteUser(session.user.id);
}

export async function setupTwoFactorAuthAction(password: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await setupTwoFactorAuth(session.user.id, password);
}

export async function enableTwoFactorAuthAction(code: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await enableTwoFactorAuth(session.user.id, code);
}

type TDisableTwoFactorAuthParams = {
  code: string;
  password: string;
  backupCode?: string;
};
export async function disableTwoFactorAuthAction(params: TDisableTwoFactorAuthParams) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await disableTwoFactorAuth(session.user.id, params);
}

export async function updateAvatarAction(avatarUrl: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!session.user.id) {
    throw new Error("User not found");
  }

  return await updateUser(session.user.id, { imageUrl: avatarUrl });
}

export async function removeAvatarAction(environmentId: string, fileName: string) {
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
  //Delete image from the storage
  const deletionResult = await deleteFile(environmentId, "public", fileName);

  if (deletionResult.success) {
    return await updateUser(session.user.id, { imageUrl: null });
  } else {
    throw new Error("Deletion failed");
  }
}
