"use server";

import { getServerSession } from "next-auth";

import { disableTwoFactorAuth, enableTwoFactorAuth, setupTwoFactorAuth } from "@formbricks/lib/auth/service";
import { authOptions } from "@formbricks/lib/authOptions";
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
