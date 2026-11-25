import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

export const getContactAttributes = reactCache(
  async (workspaceIds: string[], limit: number, offset: number) => {
    try {
      const contactAttributeKeys = await prisma.contactAttribute.findMany({
        where: {
          attributeKey: {
            workspaceId: { in: workspaceIds },
          },
        },
        orderBy: { id: "asc" },
        take: limit,
        skip: offset,
      });

      return contactAttributeKeys;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
