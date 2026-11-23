import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import type { ContactAttributeKeySelect } from "@formbricks/database/prisma";
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
import { requireWorkspaceContactDirectory } from "./contact-directory";

/** The columns of `TContactAttributeKey`. A key's `directoryId` stays out of every read that uses it. */
export const selectContactAttributeKey = {
  id: true,
  createdAt: true,
  updatedAt: true,
  isUnique: true,
  key: true,
  name: true,
  description: true,
  type: true,
  dataType: true,
} satisfies ContactAttributeKeySelect;

/**
 * A key belongs to a contact directory, and its own `workspaceId` only records where it was created: it
 * is null for a directory's default keys and for keys whose workspace was deleted. A read made through a
 * workspace reports that workspace, so `TContactAttributeKey` and the API responses keep their shape.
 */
export const withCallerWorkspace = <T extends object>(
  key: T,
  workspaceId: string
): T & { workspaceId: string } => ({
  ...key,
  workspaceId,
});

/** Every key of the workspace's contact directory, whichever workspace created it. */
export const getContactAttributeKeys = reactCache(
  async (workspaceId: string): Promise<TContactAttributeKey[]> => {
    const keys = await prisma.contactAttributeKey.findMany({
      where: whereAttributeKeysOfWorkspace(workspaceId),
      select: selectContactAttributeKey,
    });
    return keys.map((key) => withCallerWorkspace(key, workspaceId));
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

/** A key of the workspace's contact directory, or null when the id names no key there. */
export const getContactAttributeKeyById = async (
  id: string,
  workspaceId: string
): Promise<Pick<TContactAttributeKey, "id" | "workspaceId" | "type" | "name" | "description"> | null> => {
  const key = await prisma.contactAttributeKey.findFirst({
    where: { id, ...whereAttributeKeysOfWorkspace(workspaceId) },
    select: { id: true, type: true, name: true, description: true },
  });

  return key ? withCallerWorkspace(key, workspaceId) : null;
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

  // Before the write, so a workspace with no directory creates nothing.
  const directory = await requireWorkspaceContactDirectory(data.workspaceId);

  try {
    const contactAttributeKey = await prisma.contactAttributeKey.create({
      data: {
        key: data.key,
        name: data.name ?? formatSnakeCaseToTitleCase(data.key),
        description: data.description ?? null,
        directoryId: directory.id,
        workspaceId: data.workspaceId,
        type: "custom",
        ...(data.dataType && { dataType: data.dataType }),
      },
      select: selectContactAttributeKey,
    });

    return withCallerWorkspace(contactAttributeKey, data.workspaceId);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("Attribute key already exists");
      }
    }
    throw error;
  }
};

/** Updates a key of the workspace's contact directory; `ResourceNotFoundError` for any other key. */
export const updateContactAttributeKey = async (
  id: string,
  workspaceId: string,
  data: {
    name?: string;
    description?: string;
  }
): Promise<TContactAttributeKey> => {
  const existingKey = await prisma.contactAttributeKey.findFirst({
    where: { id, ...whereAttributeKeysOfWorkspace(workspaceId) },
    select: { type: true },
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
    select: selectContactAttributeKey,
  });

  return withCallerWorkspace(updatedKey, workspaceId);
};

/** Deletes a key of the workspace's contact directory; `ResourceNotFoundError` for any other key. */
export const deleteContactAttributeKey = async (
  id: string,
  workspaceId: string
): Promise<TContactAttributeKey> => {
  const existingKey = await prisma.contactAttributeKey.findFirst({
    where: { id, ...whereAttributeKeysOfWorkspace(workspaceId) },
    select: { type: true },
  });

  if (!existingKey) {
    throw new ResourceNotFoundError("contactAttributeKey", id);
  }

  if (existingKey.type === "default") {
    throw new OperationNotAllowedError("Cannot delete default contact attribute key");
  }

  const deletedKey = await prisma.contactAttributeKey.delete({
    where: { id },
    select: selectContactAttributeKey,
  });

  return withCallerWorkspace(deletedKey, workspaceId);
};
