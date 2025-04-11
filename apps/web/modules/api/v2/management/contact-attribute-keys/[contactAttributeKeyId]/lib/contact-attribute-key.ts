import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { TContactAttributeKeyUpdateSchema } from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ContactAttributeKey } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { cache } from "@formbricks/lib/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContactAttributeKey = reactCache(async (contactAttributeKeyId: string) =>
  cache(
    async (): Promise<Result<ContactAttributeKey, ApiErrorResponseV2>> => {
      try {
        const contactAttributeKey = await prisma.contactAttributeKey.findUnique({
          where: {
            id: contactAttributeKeyId,
          },
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
          details: [{ field: "contactAttributeKey", issue: error.message }],
        });
      }
    },
    [`management-getContactAttributeKey-${contactAttributeKeyId}`],
    {
      tags: [contactAttributeKeyCache.tag.byId(contactAttributeKeyId)],
    }
  )()
);

export const updateContactAttributeKey = async (
  contactAttributeKeyId: string,
  contactAttributeKeyInput: TContactAttributeKeyUpdateSchema
): Promise<Result<ContactAttributeKey, ApiErrorResponseV2>> => {
  try {
    const updatedKey = await prisma.contactAttributeKey.update({
      where: {
        id: contactAttributeKeyId,
      },
      data: contactAttributeKeyInput,
    });

    contactAttributeKeyCache.revalidate({
      id: contactAttributeKeyId,
      environmentId: updatedKey.environmentId,
      key: updatedKey.key,
    });

    return ok(updatedKey);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "contactAttributeKey", issue: "not found" }],
        });
      }
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [
            {
              field: "contactAttributeKey",
              issue: `Contact attribute key with "${contactAttributeKeyInput.key}" already exists`,
            },
          ],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [{ field: "contactAttributeKey", issue: error.message }],
    });
  }
};

export const deleteContactAttributeKey = async (
  contactAttributeKeyId: string
): Promise<Result<ContactAttributeKey, ApiErrorResponseV2>> => {
  try {
    const deletedKey = await prisma.contactAttributeKey.delete({
      where: {
        id: contactAttributeKeyId,
      },
    });

    contactAttributeKeyCache.revalidate({
      id: contactAttributeKeyId,
      environmentId: deletedKey.environmentId,
      key: deletedKey.key,
    });

    return ok(deletedKey);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "contactAttributeKey", issue: "not found" }],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [{ field: "contactAttributeKey", issue: error.message }],
    });
  }
};
