import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateProject } from "@formbricks/types/js";

export const getProjectForEnvironmentState = reactCache(
  async (environmentId: string): Promise<TJsEnvironmentStateProject | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          return await prisma.project.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
            select: {
              id: true,
              recontactDays: true,
              clickOutsideClose: true,
              darkOverlay: true,
              placement: true,
              inAppSurveyBranding: true,
              styling: true,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.warn(error, "Error getting project for environment state");
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getProjectForEnvironmentState-${environmentId}`],
      {
        tags: [projectCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
