import { contactCache } from "@/lib/cache/contact";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

const selectContact = {
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  attributes: {
    select: {
      value: true,
      attributeKey: {
        select: {
          key: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ContactSelect;

const transformPrismaContact = (
  prismaContact: Prisma.ContactGetPayload<{ select: typeof selectContact }>
) => {
  const contactAttributes: Record<string, string> = prismaContact.attributes.reduce((acc, attr) => {
    acc[attr.attributeKey.key] = attr.value;
    return acc;
  }, {});

  return {
    id: prismaContact.id,
    attributes: contactAttributes,
    environmentId: prismaContact.environmentId,
    createdAt: new Date(prismaContact.createdAt),
    updatedAt: new Date(prismaContact.updatedAt),
  };
};

export const getContacts = reactCache((environmentId: string) =>
  cache(
    async () => {
      validateInputs([environmentId, ZId]);

      try {
        const contacts = await prisma.contact.findMany({
          where: { environmentId },
          select: selectContact,
        });

        return contacts.map((contact) => transformPrismaContact(contact));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getContacts-${environmentId}`],
    {
      tags: [contactCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);

export const getContact = reactCache((contactId: string) =>
  cache(
    async () => {
      validateInputs([contactId, ZId]);

      try {
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: selectContact,
        });

        if (!contact) {
          return null;
        }

        return transformPrismaContact(contact);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getContact-${contactId}`],
    {
      tags: [contactCache.tag.byId(contactId)],
    }
  )()
);
