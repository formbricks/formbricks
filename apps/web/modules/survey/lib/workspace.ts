import "server-only";
import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

type WorkspaceWithTeam = Workspace & {
  teamIds: string[];
};

export const getWorkspaceWithTeamIdsByEnvironmentId = reactCache(
  async (environmentId: string): Promise<WorkspaceWithTeam | null> => {
    let workspacePrisma: Prisma.WorkspaceGetPayload<{
      include: { workspaceTeams: { select: { teamId: true } } };
    }> | null = null;

    try {
      workspacePrisma = await prisma.workspace.findFirst({
        where: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
        include: {
          workspaceTeams: {
            select: {
              teamId: true,
            },
          },
        },
      });

      if (!workspacePrisma) {
        return null;
      }

      const teamIds = workspacePrisma.workspaceTeams.map((workspaceTeam) => workspaceTeam.teamId);

      return {
        ...workspacePrisma,
        teamIds,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching workspace by environment id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getWorkspaceWithTeamIds = reactCache(
  async (workspaceId: string): Promise<WorkspaceWithTeam | null> => {
    let workspacePrisma: Prisma.WorkspaceGetPayload<{
      include: { workspaceTeams: { select: { teamId: true } } };
    }> | null = null;

    try {
      workspacePrisma = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
        include: {
          workspaceTeams: {
            select: {
              teamId: true,
            },
          },
        },
      });

      if (!workspacePrisma) {
        return null;
      }

      const teamIds = workspacePrisma.workspaceTeams.map((workspaceTeam) => workspaceTeam.teamId);

      return {
        ...workspacePrisma,
        teamIds,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching workspace by id");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
