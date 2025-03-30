import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import {
  TContactAttributeKey,
  TContactAttributeKeyType,
  ZContactAttributeKeyType,
} from "@formbricks/types/contact-attribute-key";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
import {
  TContactAttributeKeyUpdateInput,
  ZContactAttributeKeyUpdateInput,
} from "../types/contact-attribute-keys";

export const getContactAttributeKey = reactCache(
  (contactAttributeKeyId: string): Promise<TContactAttributeKey | null> =>
    cache(
      async () => {
        try {
          const contactAttributeKey = await prisma.contactAttributeKey.findUnique({
            where: {
              id: contactAttributeKeyId,
            },
          });

          return contactAttributeKey;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getContactAttributeKey-attribute-keys-management-api-${contactAttributeKeyId}`],
      {
        tags: [contactAttributeKeyCache.tag.byId(contactAttributeKeyId)],
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

export const deleteContactAttributeKey = async (
  contactAttributeKeyId: string
): Promise<TContactAttributeKey> => {
  validateInputs([contactAttributeKeyId, ZId]);

  try {
    const deletedContactAttributeKey = await prisma.contactAttributeKey.delete({
      where: {
        id: contactAttributeKeyId,
      },
    });

    contactAttributeKeyCache.revalidate({
      id: deletedContactAttributeKey.id,
      environmentId: deletedContactAttributeKey.environmentId,
      key: deletedContactAttributeKey.key,
    });

    return deletedContactAttributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateContactAttributeKey = async (
  contactAttributeKeyId: string,
  data: TContactAttributeKeyUpdateInput
): Promise<TContactAttributeKey | null> => {
  validateInputs([contactAttributeKeyId, ZId], [data, ZContactAttributeKeyUpdateInput]);

  try {
    const contactAttributeKey = await prisma.contactAttributeKey.update({
      where: {
        id: contactAttributeKeyId,
      },
      data: {
        description: data.description,
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
