import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getEnvironmentIdIfExists = reactCache(
  async (environmentId: string): Promise<string | null> =>
    cache(
      async () => {
        const environment = await prisma.environment.findUnique({
          where: {
            id: environmentId,
          },
          select: {
            id: true,
          },
        });

        if (!environment) {
          throw new ResourceNotFoundError("Environment", environmentId);
        }

        return environment.id;
      },

      [`survey-list-getEnvironmentIdIfExists-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);

export const getProjectIdIfEnvironmentExists = reactCache(
  async (environmentId: string): Promise<string | null> =>
    cache(
      async () => {
        const environment = await prisma.environment.findUnique({
          where: {
            id: environmentId,
          },
          select: {
            projectId: true,
          },
        });

        if (!environment) {
          throw new ResourceNotFoundError("Environment", environmentId);
        }

        return environment.projectId;
      },
      [`survey-list-getProjectIdIfEnvironmentExists-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
