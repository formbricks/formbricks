import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

export const getContactAttributeKeys = reactCache(
  async (environmentId: string): Promise<TContactAttributeKey[]> => {
    return await prisma.contactAttributeKey.findMany({
      where: { environmentId },
    });
  }
);

export const updateContactAttributeKey = async (
  environmentId: string,
  keyId: string,
  data: {
    name: string;
    description?: string;
    dataType: TContactAttributeDataType;
  }
): Promise<TContactAttributeKey> => {
  return await prisma.contactAttributeKey.update({
    where: {
      id: keyId,
      environmentId,
    },
    data,
  });
};

export const createContactAttributeKey = async (
  environmentId: string,
  key: string,
  type: "default" | "custom",
  data: {
    name: string;
    description?: string;
    dataType: TContactAttributeDataType;
  }
): Promise<TContactAttributeKey> => {
  return await prisma.contactAttributeKey.create({
    data: {
      key,
      type,
      environmentId,
      ...data,
    },
  });
};
