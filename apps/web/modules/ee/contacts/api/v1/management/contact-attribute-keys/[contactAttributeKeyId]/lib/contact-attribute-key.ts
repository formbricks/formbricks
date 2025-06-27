import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError } from "@formbricks/types/errors";
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
