import { Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const getProjectByEnvironmentId = reactCache(
  async (environmentId: string): Promise<Project | null> =>
    cache(
      async () => {
        validateInputs([environmentId, z.string().cuid2()]);

        let projectPrisma;

        try {
          projectPrisma = await prisma.project.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
          });

          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error fetching project by environment id");
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`project-settings-look-getProjectByEnvironmentId-${environmentId}`],
      {
        tags: [projectCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
