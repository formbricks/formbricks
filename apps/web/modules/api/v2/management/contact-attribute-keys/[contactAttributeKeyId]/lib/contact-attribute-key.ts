import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { TContactAttributeKeyUpdateSchema } from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  selectContactAttributeKey,
  withCallerWorkspace,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  ContactDirectoryMissingError,
  withWorkspaceDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";

/** The key with its directory, which decides who may reach it. */
export const getContactAttributeKey = reactCache(async (contactAttributeKeyId: string) => {
  try {
    const contactAttributeKey = await prisma.contactAttributeKey.findUnique({
      where: {
        id: contactAttributeKeyId,
      },
      select: { ...selectContactAttributeKey, directoryId: true },
    });

    if (!contactAttributeKey) {
      return err({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
      });
    }

    return ok(contactAttributeKey);
  } catch (error) {
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
});

/** `workspaceId` is the caller's workspace the route authorized, reported in the response. */
export const updateContactAttributeKey = async (
  contactAttributeKeyId: string,
  workspaceId: string,
  contactAttributeKeyInput: TContactAttributeKeyUpdateSchema
): Promise<Result<TContactAttributeKey, ApiErrorResponseV2>> => {
  try {
    // Only allow updating name and description, not key
    const updateData: Prisma.ContactAttributeKeyUpdateInput = {
      name: contactAttributeKeyInput.name,
      description: contactAttributeKeyInput.description,
    };

    // The route authorized `workspaceId` on the key's directory; under the workspace's lock, the write
    // only matches while the key is still in the workspace's directory.
    const updatedKey = await withWorkspaceDirectory(workspaceId, (tx, directory) =>
      tx.contactAttributeKey.update({
        where: { id: contactAttributeKeyId, directoryId: directory.id },
        data: updateData,
        select: selectContactAttributeKey,
      })
    );

    await prisma.contactAttribute.findMany({
      where: {
        attributeKeyId: updatedKey.id,
      },
      select: {
        id: true,
        contactId: true,
      },
    });

    return ok(withCallerWorkspace(updatedKey, workspaceId));
  } catch (error) {
    if (
      error instanceof ContactDirectoryMissingError ||
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
            issue: "Contact attribute key update conflict",
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

/** `workspaceId` is the caller's workspace the route authorized, reported in the response. */
export const deleteContactAttributeKey = async (
  contactAttributeKeyId: string,
  workspaceId: string
): Promise<Result<TContactAttributeKey, ApiErrorResponseV2>> => {
  try {
    // As in update: only while the key is still in the workspace's directory, under its lock.
    const deletedKey = await withWorkspaceDirectory(workspaceId, (tx, directory) =>
      tx.contactAttributeKey.delete({
        where: { id: contactAttributeKeyId, directoryId: directory.id },
        select: selectContactAttributeKey,
      })
    );

    await prisma.contactAttribute.findMany({
      where: {
        attributeKeyId: deletedKey.id,
      },
      select: {
        id: true,
        contactId: true,
      },
    });

    return ok(withCallerWorkspace(deletedKey, workspaceId));
  } catch (error) {
    if (
      error instanceof ContactDirectoryMissingError ||
      isPrismaKnownRequestError(error, PrismaErrorType.RelatedRecordNotFound) ||
      isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)
    ) {
      return err({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
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
