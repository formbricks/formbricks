"use server";

import { updateProfile, deleteProfile } from "@formbricks/lib/services/profile";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";

export async function profileEditAction(userId: string, data: Partial<TProfileUpdateInput>) {
  return await updateProfile(userId, data);
}

export async function profileDeleteAction(userId: string) {
  return await deleteProfile(userId);
}
