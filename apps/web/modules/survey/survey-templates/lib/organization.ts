import { TOrganizationAIKeys } from "@/modules/survey/survey-templates/types/organizations";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const getOrganizationAIKeys = reactCache(
  async (organizationId: string): Promise<TOrganizationAIKeys | null> =>
    cache(
      async () => {
        try {
          const organization = await prisma.organization.findUnique({
            where: {
              id: organizationId,
            },
            select: {
              isAIEnabled: true,
              billing: true,
            },
          });
          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-templates-getOrganizationAIKeys-${organizationId}`],
      {
        tags: [organizationCache.tag.byId(organizationId)],
      }
    )()
);
