import { Language, Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getProject = reactCache(async (projectId: string): Promise<Project | null> => {
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
});

export const getProjectLanguages = reactCache(async (projectId: string): Promise<Language[]> => {
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
});
