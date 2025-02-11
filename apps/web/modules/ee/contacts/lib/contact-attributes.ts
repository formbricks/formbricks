import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";

const selectContactAttribute = {
  value: true,
  attributeKey: {
    select: {
      key: true,
      name: true,
    },
  },
} satisfies Prisma.ContactAttributeSelect;

export const getContactAttributes = reactCache((contactId: string) =>
  cache(
    async () => {
      validateInputs([contactId, ZId]);

      try {
        const prismaAttributes = await prisma.contactAttribute.findMany({
          where: {
            contactId,
          },
          select: selectContactAttribute,
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
    [`getContactAttributes-${contactId}`],
    {
      tags: [contactAttributeCache.tag.byContactId(contactId)],
    }
  )()
);

export const hasEmailAttribute = reactCache(
  async (email: string, environmentId: string, contactId: string): Promise<boolean> =>
    cache(
      async () => {
        validateInputs([email, ZUserEmail], [environmentId, ZId], [contactId, ZId]);

        const contactAttribute = await prisma.contactAttribute.findFirst({
          where: {
            AND: [
              {
                attributeKey: {
                  key: "email",
                  environmentId,
                },
                value: email,
              },
              {
                NOT: {
                  contactId,
                },
              },
            ],
          },
          select: { id: true },
        });

        return !!contactAttribute;
      },
      [`hasEmailAttribute-${email}-${environmentId}-${contactId}`],
      {
        tags: [
          contactAttributeKeyCache.tag.byEnvironmentIdAndKey(environmentId, "email"),
          contactAttributeCache.tag.byEnvironmentId(environmentId),
          contactAttributeCache.tag.byContactId(contactId),
        ],
      }
    )()
);
