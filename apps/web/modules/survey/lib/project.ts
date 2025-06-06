import "server-only";
import { Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

type ProjectWithTeam = Project & {
  teamIds: string[];
};

export const getProjectWithTeamIdsByEnvironmentId = reactCache(
  async (environmentId: string): Promise<ProjectWithTeam | null> => {
    let projectPrisma: Prisma.ProjectGetPayload<{
      include: { projectTeams: { select: { teamId: true } } };
    }> | null = null;

    try {
      projectPrisma = await prisma.project.findFirst({
        where: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
        include: {
          projectTeams: {
            select: {
              teamId: true,
            },
          },
        },
      });

      if (!projectPrisma) {
        return null;
      }

      const teamIds = projectPrisma.projectTeams.map((projectTeam) => projectTeam.teamId);

      return {
        ...projectPrisma,
        teamIds,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching project by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
