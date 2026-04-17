import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserIdWithAttributes = reactCache(async (workspaceId: string, userId: string) => {
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId,
      attributes: { some: { attributeKey: { key: "userId", workspaceId }, value: userId } },
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
