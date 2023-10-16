"use server";
import { authOptions } from "@formbricks/lib/authOptions";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import { NotificationSettings } from "@formbricks/types/users";

export async function updateNotificationSettingsAction(notificationSettings: NotificationSettings) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthorizationError("Not authenticated");
  }

  // update user with notification settings
  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationSettings },
  });
}
