"use server";

import { prisma } from "@formbricks/database";
import { NotificationSettings } from "@formbricks/types/users";

export async function toggleUserNotification(
  trigger: "responseFinished" | "weeklySummary",
  surveyId: string,
  userId: string,
  notificationSettings: NotificationSettings
) {
  // update notification settings
  notificationSettings[surveyId][trigger] = !notificationSettings[surveyId][trigger];
  console.log(notificationSettings);
  // update user with notification settings
  await prisma.user.update({
    where: { id: userId },
    data: { notificationSettings },
  });
}
