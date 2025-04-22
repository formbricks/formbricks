import { cache } from "@/lib/cache";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import {
  TContactAttributeKey,
  TContactAttributeKeyType,
  ZContactAttributeKeyType,
} from "@formbricks/types/contact-attribute-key";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";

export const getContactAttributeKeys = reactCache(
  (environmentIds: string[]): Promise<TContactAttributeKey[]> =>
    cache(
      async () => {
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
      },
      environmentIds.map((id) => `getContactAttributeKeys-attribute-keys-management-api-${id}`),
      {
        tags: environmentIds.map((id) => contactAttributeKeyCache.tag.byEnvironmentId(id)),
      }
    )()
);

export const createContactAttributeKey = async (
  environmentId: string,
  key: string,
  type: TContactAttributeKeyType
): Promise<TContactAttributeKey | null> => {
  validateInputs([environmentId, ZId], [name, ZString], [type, ZContactAttributeKeyType]);

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
        key,
        name: key,
        type,
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });

    contactAttributeKeyCache.revalidate({
      id: contactAttributeKey.id,
      environmentId: contactAttributeKey.environmentId,
      key: contactAttributeKey.key,
    });

    return contactAttributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
