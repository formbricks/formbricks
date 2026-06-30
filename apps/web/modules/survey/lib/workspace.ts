import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, Workspace } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

type WorkspaceWithTeam = Workspace & {
  teamIds: string[];
};

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
