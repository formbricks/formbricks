import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { validateInputs } from "@/lib/utils/validate";

const selectContactAttribute = {
  value: true,
  valueNumber: true,
  valueDate: true,
  attributeKey: {
    select: {
      key: true,
      name: true,
      type: true,
      dataType: true,
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

export const getContactAttributesWithMetadata = reactCache(async (contactId: string) => {
  validateInputs([contactId, ZId]);

  try {
    const prismaAttributes = await prisma.contactAttribute.findMany({
      where: {
        contactId,
      },
      select: selectContactAttribute,
    });

    return prismaAttributes.map((attr) => ({
      key: attr.attributeKey.key,
      name: attr.attributeKey.name,
      type: attr.attributeKey.type,
      value: attr.value,
      valueNumber: attr.valueNumber,
      valueDate: attr.valueDate,
      dataType: attr.attributeKey.dataType,
    }));
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

export const hasUserIdAttribute = reactCache(
  async (userId: string, environmentId: string, contactId: string): Promise<boolean> => {
    validateInputs([userId, ZString], [environmentId, ZId], [contactId, ZId]);

    const contactAttribute = await prisma.contactAttribute.findFirst({
      where: {
        AND: [
          {
            attributeKey: {
              key: "userId",
              environmentId,
            },
            value: userId,
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

export const getDistinctAttributeValues = reactCache(
  async (attributeKeyId: string, limit: number = 50): Promise<string[]> => {
    validateInputs([attributeKeyId, ZId]);

    try {
      const results = await prisma.contactAttribute.findMany({
        where: {
          attributeKeyId,
          value: { not: "" },
        },
        select: {
          value: true,
        },
        distinct: ["value"],
        take: limit * 2, // Get more than needed to account for filtering
        orderBy: { value: "asc" },
      });

      return results.map((r) => r.value);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
