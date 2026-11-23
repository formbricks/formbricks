import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { formatSnakeCaseToTitleCase } from "@formbricks/types/safe-identifier";
import {
  whereAttributeKeysOfDirectory,
  whereAttributeKeysOfWorkspace,
} from "@/modules/ee/contacts/lib/attribute-key-scope";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "./attribute-key-policy";
import { hasWorkspace, requireWorkspace } from "./workspace-row";

export const getContactAttributeKeys = reactCache(
  async (workspaceId: string): Promise<TContactAttributeKey[]> => {
    const keys = await prisma.contactAttributeKey.findMany({
      where: whereAttributeKeysOfWorkspace(workspaceId),
    });
    return keys.filter(hasWorkspace);
  }
);

export type TDirectoryAttributeKey = Pick<TContactAttributeKey, "id" | "key" | "dataType">;

/**
 * Every key of a contact directory, for the contact write paths. Unlike `getContactAttributeKeys`, it
 * keeps keys with no origin workspace (a directory's default keys, or keys whose workspace was deleted).
 */
export const getContactAttributeKeysOfDirectory = reactCache(
  async (directoryId: string): Promise<TDirectoryAttributeKey[]> =>
    prisma.contactAttributeKey.findMany({
      where: whereAttributeKeysOfDirectory(directoryId),
      select: { id: true, key: true, dataType: true },
    })
);

export const getContactAttributeKeyById = async (
  id: string
): Promise<Pick<TContactAttributeKey, "id" | "workspaceId" | "type" | "name" | "description"> | null> => {
  const key = await prisma.contactAttributeKey.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, type: true, name: true, description: true },
  });

  return key && hasWorkspace(key) ? key : null;
};

export const createContactAttributeKey = async (data: {
  workspaceId: string;
  key: string;
  name?: string;
  description?: string;
  dataType?: TContactAttributeDataType;
}): Promise<TContactAttributeKey> => {
  if (isReservedFutureDefaultAttributeKey(data.key)) {
    throw new InvalidInputError(getReservedFutureDefaultAttributeKeyIssue([data.key]));
  }

  try {
    const contactAttributeKey = await prisma.contactAttributeKey.create({
      data: {
        key: data.key,
        name: data.name ?? formatSnakeCaseToTitleCase(data.key),
        description: data.description ?? null,
        workspaceId: data.workspaceId,
        type: "custom",
        ...(data.dataType && { dataType: data.dataType }),
      },
    });

    return requireWorkspace(contactAttributeKey, "contactAttributeKey");
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("Attribute key already exists");
      }
    }
    throw error;
  }
};

export const updateContactAttributeKey = async (
  id: string,
  data: {
    name?: string;
    description?: string;
  }
): Promise<TContactAttributeKey> => {
  const existingKey = await prisma.contactAttributeKey.findUnique({
    where: { id },
  });

  if (!existingKey) {
    throw new ResourceNotFoundError("contactAttributeKey", id);
  }

  if (existingKey.type === "default") {
    throw new OperationNotAllowedError("Cannot update default contact attribute key");
  }

  const updatedKey = await prisma.contactAttributeKey.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });

  return requireWorkspace(updatedKey, "contactAttributeKey");
};

export const deleteContactAttributeKey = async (id: string): Promise<TContactAttributeKey> => {
  const existingKey = await prisma.contactAttributeKey.findUnique({
    where: { id },
  });

  if (!existingKey) {
    throw new ResourceNotFoundError("contactAttributeKey", id);
  }

  if (existingKey.type === "default") {
    throw new OperationNotAllowedError("Cannot delete default contact attribute key");
  }

  const deletedKey = await prisma.contactAttributeKey.delete({
    where: { id },
  });

  return requireWorkspace(deletedKey, "contactAttributeKey");
};
