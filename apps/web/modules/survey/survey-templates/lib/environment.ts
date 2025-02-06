import { Environment } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<Pick<Environment, "id" | "appSetupCompleted"> | null> =>
    cache(
      async () => {
        const environment = await prisma.environment.findUnique({
          where: { id: environmentId },
          select: {
            id: true,
            appSetupCompleted: true,
          },
        });
        return environment;
      },
      [`survey-templates-getEnvironment-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
