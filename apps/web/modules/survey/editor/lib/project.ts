import { Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const getProject = reactCache(
  async (projectId: string): Promise<Project | null> =>
    cache(
      async () => {
        try {
          const projectPrisma = await prisma.project.findUnique({
            where: {
              id: projectId,
            },
          });

          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error fetching project");
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`survey-editor-getProject-${projectId}`],
      {
        tags: [projectCache.tag.byId(projectId)],
      }
    )()
);
