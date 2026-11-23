import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { whereAttributeKey } from "@/modules/ee/contacts/lib/attribute-key-scope";

export const getContactByUserIdWithAttributes = reactCache(async (workspaceId: string, userId: string) => {
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId,
      attributes: { some: { attributeKey: whereAttributeKey(workspaceId, "userId"), value: userId } },
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
