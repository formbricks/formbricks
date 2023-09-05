import "server-only";
import { prisma } from "@formbricks/database";

export function getNotifications(userId) {
  const data = prisma.notification.findMany({
    where: {
      userId,
    },
    include: {
      user: true,
    },
  });
  console.log(data);
  if (!data) {
    throw new Error("No notifications found");
  }
  return data;
}
