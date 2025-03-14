import "server-only";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TProjectWithLanguages } from "@/modules/survey/list/types/surveys";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const getProjectWithLanguagesByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TProjectWithLanguages | null> =>
    cache(
      async () => {
        try {
          const projectPrisma = await prisma.project.findFirst({
            where: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
            select: {
              id: true,
              languages: true,
            },
          });

          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error getting project with languages by environment id");
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`survey-list-getProjectByEnvironmentId-${environmentId}`],
      {
        tags: [projectCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getUserProjects = reactCache(
  async (userId: string, organizationId: string): Promise<TUserProject[]> =>
    cache(
      async () => {
        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              name: true,
              environments: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          });

          return projects;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-list-getUserProjects-${userId}-${organizationId}`],
      {
        tags: [projectCache.tag.byUserId(userId), projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
