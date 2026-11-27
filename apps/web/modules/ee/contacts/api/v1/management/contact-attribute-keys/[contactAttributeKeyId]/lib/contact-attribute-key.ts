import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import {
  selectContactAttributeKey,
  withCallerWorkspace,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  TContactAttributeKeyUpdateInput,
  ZContactAttributeKeyUpdateInput,
} from "../types/contact-attribute-keys";

/** The key with its directory, which decides who may reach it; null when it does not exist. */
export const getContactAttributeKey = reactCache(async (contactAttributeKeyId: string) => {
  try {
    return await prisma.contactAttributeKey.findUnique({
      where: {
        id: contactAttributeKeyId,
      },
      select: { ...selectContactAttributeKey, directoryId: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/** `workspaceId` is the caller's workspace the route authorized, reported in the response. */
export const deleteContactAttributeKey = async (
  contactAttributeKeyId: string,
  workspaceId: string
): Promise<TContactAttributeKey> => {
  validateInputs([contactAttributeKeyId, ZId]);

  try {
    const deletedContactAttributeKey = await prisma.contactAttributeKey.delete({
      where: {
        id: contactAttributeKeyId,
      },
      select: selectContactAttributeKey,
    });

    return withCallerWorkspace(deletedContactAttributeKey, workspaceId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/** `workspaceId` is the caller's workspace the route authorized, reported in the response. */
export const updateContactAttributeKey = async (
  contactAttributeKeyId: string,
  workspaceId: string,
  data: TContactAttributeKeyUpdateInput
): Promise<TContactAttributeKey | null> => {
  validateInputs([contactAttributeKeyId, ZId], [data, ZContactAttributeKeyUpdateInput]);

  if (data.key && isReservedFutureDefaultAttributeKey(data.key)) {
    throw new InvalidInputError(getReservedFutureDefaultAttributeKeyIssue([data.key]));
  }

  try {
    const contactAttributeKey = await prisma.contactAttributeKey.update({
      where: {
        id: contactAttributeKeyId,
      },
      data: {
        description: data.description,
        name: data.name,
        key: data.key,
        ...(data.dataType && { dataType: data.dataType }),
      },
      select: selectContactAttributeKey,
    });

    return withCallerWorkspace(contactAttributeKey, workspaceId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
