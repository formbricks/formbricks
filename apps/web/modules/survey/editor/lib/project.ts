import { cache } from "@/lib/cache";
import { projectCache } from "@/lib/project/cache";
import { Language, Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

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

export const getProjectLanguages = reactCache(
  async (projectId: string): Promise<Language[]> =>
    cache(
      async () => {
        const project = await prisma.project.findUnique({
          where: {
            id: projectId,
          },
          select: {
            languages: true,
          },
        });
        if (!project) {
          throw new ResourceNotFoundError("Project not found", projectId);
        }
        return project.languages;
      },
      [`survey-editor-getProjectLanguages-${projectId}`],
      {
        tags: [projectCache.tag.byId(projectId)],
      }
    )()
);
