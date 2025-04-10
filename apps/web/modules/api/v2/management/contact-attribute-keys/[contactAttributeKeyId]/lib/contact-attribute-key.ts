import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
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
          details: [{ field: "ContactAttributeKey", issue: "not found" }],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [{ field: "ContactAttributeKey", issue: error.message }],
    });
  }
};
