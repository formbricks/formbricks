import { contactCache } from "@/lib/cache/contact";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError } from "@formbricks/types/errors";

export const getContact = reactCache((contactId: string) =>
  cache(
    async () => {
      try {
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { id: true },
        });

        return contact;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
      }
    },
    [`getContact-responses-api-${contactId}`],
    {
      tags: [contactCache.tag.byId(contactId)],
    }
  )()
);

export const getContactByUserId = reactCache(
  (
    environmentId: string,
    userId: string
  ): Promise<{
    id: string;
    attributes: TContactAttributes;
  } | null> =>
    cache(
      async () => {
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
      },
      [`getContactByUserIdForResponsesApi-${environmentId}-${userId}`],
      {
        tags: [contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);
