"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { updateProfile, deleteProfile } from "@formbricks/lib/services/profile";
import { setupTwoFactorAuth } from "@formbricks/lib/services/auth";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";
import { getServerSession } from "next-auth";

export async function profileEditAction(userId: string, data: Partial<TProfileUpdateInput>) {
  return await updateProfile(userId, data);
}

export async function profileDeleteAction(userId: string) {
  return await deleteProfile(userId);
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
