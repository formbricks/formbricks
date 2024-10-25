import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { contactAttributeKeyCache } from "../cache/contact-attribute-key";

export const getContactAttributeKeys = reactCache(
  (environmentId: string): Promise<TContactAttributeKey[]> =>
    cache(
      async () => {
        return await prisma.contactAttributeKey.findMany({
          where: { environmentId },
        });
      },
      [`getContactAttributeKeys-${environmentId}`],
      {
        tags: [contactAttributeKeyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const createContactAttributeKey = async (
  environmentId: string,
  key: string
): Promise<TContactAttributeKey> => {
  try {
    const attributeKey = await prisma.contactAttributeKey.create({
      data: {
        environmentId,
        key,
      },
    });

    contactAttributeKeyCache.revalidate({ environmentId });

    return attributeKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
