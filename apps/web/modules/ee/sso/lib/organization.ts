import { cache } from "@/lib/cache";
import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const getFirstOrganization = reactCache(
  async (): Promise<Organization | null> =>
    cache(
      async () => {
        try {
          const organization = await prisma.organization.findFirst({});
          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getFirstOrganization`],
      {
        tags: [],
      }
    )()
);
