import { ContactAttributeKey, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TContactAttributeKeyUpdateSchema } from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getContactAttributeKey = reactCache(async (contactAttributeKeyId: string) => {
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
});

export const updateContactAttributeKey = async (
  contactAttributeKeyId: string,
  contactAttributeKeyInput: TContactAttributeKeyUpdateSchema
): Promise<Result<ContactAttributeKey, ApiErrorResponseV2>> => {
  try {
    // Only allow updating name and description, not key
    const updateData: Prisma.ContactAttributeKeyUpdateInput = {
      name: contactAttributeKeyInput.name,
      description: contactAttributeKeyInput.description,
    };

    const updatedKey = await prisma.contactAttributeKey.update({
      where: {
        id: contactAttributeKeyId,
      },
      data: updateData,
    });

    await prisma.contactAttribute.findMany({
      where: {
        attributeKeyId: updatedKey.id,
      },
      select: {
        id: true,
        contactId: true,
      },
    });

    return ok(updatedKey);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
              issue: "Contact attribute key update conflict",
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

    await prisma.contactAttribute.findMany({
      where: {
        attributeKeyId: deletedKey.id,
      },
      select: {
        id: true,
        contactId: true,
      },
    });

    return ok(deletedKey);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
