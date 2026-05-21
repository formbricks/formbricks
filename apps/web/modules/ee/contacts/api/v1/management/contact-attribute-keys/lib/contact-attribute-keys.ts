import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { formatSnakeCaseToTitleCase } from "@/lib/utils/safe-identifier";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";

export const getContactAttributeKeys = reactCache(
  async (workspaceIds: string[]): Promise<TContactAttributeKey[]> => {
    try {
      const contactAttributeKeys = await prisma.contactAttributeKey.findMany({
        where: { workspaceId: { in: workspaceIds } },
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
  workspaceId: string,
  data: TContactAttributeKeyCreateInput
): Promise<TContactAttributeKey | null> => {
  if (isReservedFutureDefaultAttributeKey(data.key)) {
    throw new InvalidInputError(getReservedFutureDefaultAttributeKeyIssue([data.key]));
  }

  const contactAttributeKeysCount = await prisma.contactAttributeKey.count({
    where: {
      workspaceId,
    },
  });

  if (contactAttributeKeysCount >= MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    throw new OperationNotAllowedError(
      `Maximum number of attribute classes (${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT}) reached for workspace ${workspaceId}`
    );
  }
  try {
    const contactAttributeKey = await prisma.contactAttributeKey.create({
      data: {
        key: data.key,
        name: data.name ?? formatSnakeCaseToTitleCase(data.key),
        type: data.type,
        description: data.description ?? "",
        ...(data.dataType && { dataType: data.dataType }),
        workspaceId,
      },
    });

    return contactAttributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new DatabaseError("Attribute key already exists");
      }

      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
