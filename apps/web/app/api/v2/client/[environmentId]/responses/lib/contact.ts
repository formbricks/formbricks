import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";

type TContactAttributeResult = {
  attributeKey: {
    key: string;
  };
  value: string;
};

export const getContact = reactCache(async (contactId: string, environmentId: string) => {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId, environmentId },
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

  const contactAttributes = contact.attributes.reduce(
    (acc: TContactAttributes, attr: TContactAttributeResult) => {
      acc[attr.attributeKey.key] = attr.value;
      return acc;
    },
    {}
  );

  return {
    id: contact.id,
    attributes: contactAttributes,
  };
});
