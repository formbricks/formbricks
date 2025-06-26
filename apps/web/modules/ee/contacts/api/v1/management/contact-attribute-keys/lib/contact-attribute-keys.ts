import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";

export const getContactAttributeKeys = reactCache(
  async (environmentIds: string[]): Promise<TContactAttributeKey[]> => {
    try {
      const contactAttributeKeys = await prisma.contactAttributeKey.findMany({
        where: { environmentId: { in: environmentIds } },
      });

      return contactAttributeKeys;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const createContactAttributeKey = async (
  environmentId: string,
  data: TContactAttributeKeyCreateInput
): Promise<TContactAttributeKey | null> => {
  const contactAttributeKeysCount = await prisma.contactAttributeKey.count({
    where: {
      environmentId,
    },
  });

  if (contactAttributeKeysCount >= MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    throw new OperationNotAllowedError(
      `Maximum number of attribute classes (${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT}) reached for environment ${environmentId}`
    );
  }

  try {
    const contactAttributeKey = await prisma.contactAttributeKey.create({
      data: {
        key: data.key,
        name: data.name || data.key,
        type: data.type,
        description: data.description || "",
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });

    return contactAttributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
