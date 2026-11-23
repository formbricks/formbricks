import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { formatSnakeCaseToTitleCase } from "@formbricks/types/safe-identifier";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import { whereAttributeKeysOfDirectory } from "@/modules/ee/contacts/lib/attribute-key-scope";
import {
  selectContactAttributeKey,
  withCallerWorkspace,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getReportingWorkspaceByDirectory,
  requireWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";

/**
 * Every key of the contact directories the given workspaces use. Two of those workspaces on one
 * directory see the same keys, so each key is listed once, under one of them.
 */
export const getContactAttributeKeys = reactCache(
  async (workspaceIds: string[]): Promise<TContactAttributeKey[]> => {
    try {
      const workspaceByDirectory = await getReportingWorkspaceByDirectory(workspaceIds);
      if (workspaceByDirectory.size === 0) return [];

      const contactAttributeKeys = await prisma.contactAttributeKey.findMany({
        where: { directoryId: { in: [...workspaceByDirectory.keys()] } },
        select: { ...selectContactAttributeKey, directoryId: true },
      });

      return contactAttributeKeys.flatMap(({ directoryId, ...key }) => {
        const workspaceId = directoryId ? workspaceByDirectory.get(directoryId) : undefined;
        return workspaceId ? [withCallerWorkspace(key, workspaceId)] : [];
      });
    } catch (error) {
      if (isPrismaKnownRequestError(error)) {
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

  // Before the write, so a workspace with no directory creates nothing. Keys, and their cap, are per directory.
  const directory = await requireWorkspaceContactDirectory(workspaceId);
  const contactAttributeKeysCount = await prisma.contactAttributeKey.count({
    where: whereAttributeKeysOfDirectory(directory.id),
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
        directoryId: directory.id,
        workspaceId,
      },
      select: selectContactAttributeKey,
    });

    return withCallerWorkspace(contactAttributeKey, workspaceId);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // A caller mistake, not a server fault: the route shows this message at 400.
      throw new InvalidInputError("Attribute key already exists");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
