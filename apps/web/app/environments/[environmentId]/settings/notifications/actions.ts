"use server";

import { prisma } from "@formbricks/database";
import { NotificationSettings } from "@formbricks/types/users";

export async function updateNotificationSettings(userId: string, notificationSettings: NotificationSettings) {
  // update user with notification settings
  await prisma.user.update({
    where: { id: userId },
    data: { notificationSettings },
  });
}
