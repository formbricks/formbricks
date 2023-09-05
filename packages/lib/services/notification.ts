import "server-only";
import { prisma } from "@formbricks/database";

export function getNotifications(userId) {
  const data = prisma.notifications.findMany({
    where: {
      userId,
    },
  });
  if (!data) {
    throw new Error("No notifications found");
  }
  return data;
}
