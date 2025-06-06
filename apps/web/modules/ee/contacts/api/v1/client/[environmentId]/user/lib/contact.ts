import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserIdWithAttributes = reactCache(async (environmentId: string, userId: string) => {
  const contact = await prisma.contact.findFirst({
    where: {
      environmentId,
      attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
    },
    select: {
      id: true,
      attributes: {
        select: { attributeKey: { select: { key: true } }, value: true },
      },
    },
  });

  if (!contact) {
    return null;
  }

  return contact;
});
