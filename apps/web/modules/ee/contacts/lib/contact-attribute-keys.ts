import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getContactAttributeKeys = reactCache(
  async (environmentId: string): Promise<TContactAttributeKey[]> => {
    return await prisma.contactAttributeKey.findMany({
      where: { environmentId },
    });
  }
);

export const getContactAttributeKeyById = async (
  id: string
): Promise<Pick<TContactAttributeKey, "id" | "environmentId" | "type" | "name" | "description"> | null> => {
  const key = await prisma.contactAttributeKey.findUnique({
    where: { id },
    select: { id: true, environmentId: true, type: true, name: true, description: true },
  });

  return key;
};

export const createContactAttributeKey = async (data: {
  environmentId: string;
  key: string;
  name?: string;
  description?: string;
  dataType?: TContactAttributeDataType;
}): Promise<TContactAttributeKey> => {
  try {
    const contactAttributeKey = await prisma.contactAttributeKey.create({
      data: {
        key: data.key,
        name: data.name ?? data.key,
        description: data.description ?? null,
        environmentId: data.environmentId,
        type: "custom",
        ...(data.dataType && { dataType: data.dataType }),
      },
    });

    return contactAttributeKey;
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
    console.log("throwing resource not found error");
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

  return updatedKey;
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

  return deletedKey;
};
