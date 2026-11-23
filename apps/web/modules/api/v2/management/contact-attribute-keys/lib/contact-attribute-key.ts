import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { formatSnakeCaseToTitleCase } from "@formbricks/types/safe-identifier";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { getContactAttributeKeysQuery } from "@/modules/api/v2/management/contact-attribute-keys/lib/utils";
import {
  TContactAttributeKeyInput,
  TGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import {
  selectContactAttributeKey,
  withCallerWorkspace,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  getReportingWorkspaceByDirectory,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";

/**
 * Every key of the contact directories the given workspaces use. Two of those workspaces on one
 * directory see the same keys, so each key is listed once, under one of them (`workspaceId`).
 */
export const getContactAttributeKeys = reactCache(
  async (workspaceIds: string[], params: TGetContactAttributeKeysFilter) => {
    try {
      const workspaceByDirectory = await getReportingWorkspaceByDirectory(workspaceIds);
      const query = getContactAttributeKeysQuery([...workspaceByDirectory.keys()], params);

      const [keys, count] = await prisma.$transaction([
        prisma.contactAttributeKey.findMany({
          ...query,
          select: { ...selectContactAttributeKey, directoryId: true },
        }),
        prisma.contactAttributeKey.count({
          where: query.where,
        }),
      ]);

      const data = keys.flatMap(({ directoryId, ...key }) => {
        const workspaceId = directoryId ? workspaceByDirectory.get(directoryId) : undefined;
        return workspaceId ? [withCallerWorkspace(key, workspaceId)] : [];
      });

      return ok({ data, meta: { total: count, limit: params.limit, offset: params.skip } });
    } catch (error) {
      return err({
        type: "internal_server_error",
        details: [
          {
            field: "contactAttributeKeys",
            issue: error instanceof Error ? error.message : "Unknown error occurred",
          },
        ],
      });
    }
  }
);

export const createContactAttributeKey = async (
  contactAttributeKey: TContactAttributeKeyInput
): Promise<Result<TContactAttributeKey, ApiErrorResponseV2>> => {
  const { workspaceId, name, description, key, dataType } = contactAttributeKey;

  if (isReservedFutureDefaultAttributeKey(key)) {
    return err({
      type: "bad_request",
      details: [{ field: "key", issue: getReservedFutureDefaultAttributeKeyIssue([key]) }],
    });
  }

  // Keys belong to the workspace's contact directory; with none, nothing is created.
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (!directory) {
    return err({
      type: "forbidden",
      details: [{ field: "workspaceId", issue: CONTACT_DIRECTORY_MISSING_MESSAGE }],
    });
  }

  try {
    const prismaData: Prisma.ContactAttributeKeyCreateInput = {
      directory: { connect: { id: directory.id } },
      workspace: {
        connect: {
          id: workspaceId,
        },
      },
      name: name ?? formatSnakeCaseToTitleCase(key),
      description,
      key,
      ...(dataType && { dataType }),
    };

    const createdContactAttributeKey = await prisma.contactAttributeKey.create({
      data: prismaData,
      select: selectContactAttributeKey,
    });

    return ok(withCallerWorkspace(createdContactAttributeKey, workspaceId));
  } catch (error) {
    if (
      isPrismaKnownRequestError(error, PrismaErrorType.RelatedRecordNotFound) ||
      isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)
    ) {
      return err({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
      });
    }
    if (isUniqueConstraintError(error)) {
      return err({
        type: "conflict",
        details: [
          {
            field: "contactAttributeKey",
            issue: `Contact attribute key with "${contactAttributeKey.key}" already exists`,
          },
        ],
      });
    }
    return err({
      type: "internal_server_error",
      details: [
        {
          field: "contactAttributeKey",
          issue: error instanceof Error ? error.message : "Unknown error occurred",
        },
      ],
    });
  }
};
