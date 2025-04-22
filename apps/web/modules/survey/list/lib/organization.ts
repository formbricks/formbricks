import { cache } from "@/lib/cache";
import { environmentCache } from "@/lib/environment/cache";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getOrganizationIdByEnvironmentId = reactCache(
  async (environmentId: string): Promise<string | null> =>
    cache(
      async () => {
        const organization = await prisma.organization.findFirst({
          where: {
            projects: {
              some: {
                environments: {
                  some: {
                    id: environmentId,
                  },
                },
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (!organization) {
          throw new ResourceNotFoundError("Organization", null);
        }

        return organization.id;
      },

      [`survey-list-getOrganizationIdByEnvironmentId-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
