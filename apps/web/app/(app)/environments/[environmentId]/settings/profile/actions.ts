"use server";

import { updateProfile, deleteProfile } from "@formbricks/lib/services/profile";
import { Prisma } from "@prisma/client";

export async function profileEditAction(userId: string, data: Prisma.UserUpdateInput) {
  return await updateProfile(userId, data);
}

export async function profileDeleteAction(userId: string) {
  return await deleteProfile(userId);
}
