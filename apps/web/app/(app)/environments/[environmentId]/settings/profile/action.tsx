"use server";

import { updateProfile } from "@formbricks/lib/services/profile";
import { deleteProfile } from "@formbricks/lib/services/profile";

export async function profileEditAction(userId: string, data: Object) {
  return await updateProfile(userId, data);
}

export async function profileDeleteAction(userId: string) {
    return await deleteProfile(userId);
  }