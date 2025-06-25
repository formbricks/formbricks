import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
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

export const getContactAttributes = reactCache(async (contactId: string) => {
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
});

export const hasEmailAttribute = reactCache(
  async (email: string, environmentId: string, contactId: string): Promise<boolean> => {
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
  }
);
