import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserId = reactCache(async (environmentId: string, userId: string) => {
  const contact = await prisma.contact.findFirst({
    where: {
      attributes: {
        some: {
          attributeKey: {
            key: "userId",
            environmentId,
          },
          value: userId,
        },
      },
    },
  });

  if (!contact) {
    return null;
  }

  return contact;
});
