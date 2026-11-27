import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { whereContactsOfWorkspace } from "@/modules/ee/contacts/lib/contact-directory";

type TContactAttributeResult = {
  attributeKey: {
    key: string;
  };
  value: string;
};

/** The contact, when it belongs to the workspace's directory (whichever of its workspaces created it). */
export const getContact = reactCache(async (contactId: string, workspaceId: string) => {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId, ...whereContactsOfWorkspace(workspaceId) },
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
