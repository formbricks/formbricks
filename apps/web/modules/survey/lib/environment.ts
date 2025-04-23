import { cache } from "@/lib/cache";
import { environmentCache } from "@/lib/environment/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Environment, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<Pick<Environment, "id" | "appSetupCompleted"> | null> =>
    cache(
      async () => {
        validateInputs([environmentId, z.string().cuid2()]);

        try {
          const environment = await prisma.environment.findUnique({
            where: {
              id: environmentId,
            },
            select: {
              id: true,
              appSetupCompleted: true,
            },
          });

          return environment;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error fetching environment");
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-lib-getEnvironment-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
