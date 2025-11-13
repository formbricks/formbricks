import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Organization, Prisma } from "@formbricks/database/generated/client";
import { DatabaseError } from "@formbricks/types/errors";

export const getFirstOrganization = reactCache(async (): Promise<Organization | null> => {
  try {
    const organization = await prisma.organization.findFirst({});
    return organization;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
