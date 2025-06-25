import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const getContactAttributes = reactCache(async (environmentIds: string[]) => {
  try {
    const contactAttributeKeys = await prisma.contactAttribute.findMany({
      where: {
        attributeKey: {
          environmentId: { in: environmentIds },
        },
      },
    });

    return contactAttributeKeys;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
