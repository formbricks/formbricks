import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";

export const getContact = reactCache(async (contactId: string) => {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      attributes: {
        select: {
          attributeKey: { select: { key: true } },
          value: true,
        },
      },
    },
  });

  if (!contact) {
    return null;
  }

  const contactAttributes = contact.attributes.reduce((acc, attr) => {
    acc[attr.attributeKey.key] = attr.value;
    return acc;
  }, {}) as TContactAttributes;

  return {
    id: contact.id,
    attributes: contactAttributes,
  };
});
