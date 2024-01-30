"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { updateUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";

export async function updateNotificationSettingsAction(notificationSettings: TUserNotificationSettings) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthorizationError("Not authenticated");
  }

  await updateUser(session.user.id, {
    notificationSettings,
  });
}
