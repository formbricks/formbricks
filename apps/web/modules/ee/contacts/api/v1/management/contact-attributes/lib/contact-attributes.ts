import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { whereAttributeKeysOfWorkspaces } from "@/modules/ee/contacts/lib/attribute-key-scope";

export const getContactAttributes = reactCache(async (workspaceIds: string[]) => {
  try {
    const contactAttributeKeys = await prisma.contactAttribute.findMany({
      where: {
        attributeKey: whereAttributeKeysOfWorkspaces(workspaceIds),
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
