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
import {
  TContactAttributeKeyUpdateInput,
  ZContactAttributeKeyUpdateInput,
} from "../types/contact-attribute-keys";

export const getContactAttributeKey = reactCache(
  async (contactAttributeKeyId: string): Promise<TContactAttributeKey | null> => {
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
  }
);

export const createContactAttributeKey = async (
  environmentId: string,
  key: string,
  type: TContactAttributeKeyType
): Promise<TContactAttributeKey | null> => {
  validateInputs([environmentId, ZId], [key, ZString], [type, ZContactAttributeKeyType]);

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

    return contactAttributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
