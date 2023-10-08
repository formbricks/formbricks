"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { updateProfile, deleteProfile } from "@formbricks/lib/profile/service";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function updateProfileAction(data: Partial<TProfileUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await updateProfile(session.user.id, data);
}

export async function deleteProfileAction() {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await deleteProfile(session.user.id);
}
