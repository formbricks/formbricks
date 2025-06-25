import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getProjectByEnvironmentId = reactCache(
  async (environmentId: string): Promise<Pick<Project, "styling" | "logo" | "linkSurveyBranding"> | null> => {
    validateInputs([environmentId, ZId]);

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
        select: {
          styling: true,
          logo: true,
          linkSurveyBranding: true,
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
  }
);
