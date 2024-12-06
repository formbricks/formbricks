import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError } from "@formbricks/types/errors";

export const getContactAttributes = reactCache((contactId: string) =>
  cache(
    async () => {
      validateInputs([contactId, ZId]);

      try {
        const prismaAttributes = await prisma.contactAttribute.findMany({
          where: {
            contactId,
          },
          select: {
            attributeKey: {
              select: {
                key: true,
              },
            },
            value: true,
          },
        });

        return prismaAttributes.reduce((acc, attr) => {
          acc[attr.attributeKey.key] = attr.value;
          return acc;
        }, {}) as TContactAttributes;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getContactAttributes-insights-${contactId}`],
    {
      tags: [contactAttributeCache.tag.byContactId(contactId)],
    }
  )()
);
