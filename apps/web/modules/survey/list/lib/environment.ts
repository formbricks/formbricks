import "server-only";
import { Environment, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const doesEnvironmentExist = reactCache(
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

      [`survey-list-doesEnvironmentExist-${environmentId}`],
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

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<Pick<Environment, "id" | "type"> | null> =>
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
              type: true,
            },
          });
          return environment;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error);
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-list-getEnvironment-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);
