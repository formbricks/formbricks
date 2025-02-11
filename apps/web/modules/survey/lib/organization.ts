import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getOrganizationIdFromEnvironmentId = reactCache(
  async (environmentId: string): Promise<string> =>
    cache(
      async () => {
        const organization = await prisma.organization.findFirst({
          where: {
            projects: {
              some: {
                environments: {
                  some: { id: environmentId },
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
      [`survey-lib-getOrganizationIdFromEnvironmentId-${environmentId}`],
      {
        tags: [organizationCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
