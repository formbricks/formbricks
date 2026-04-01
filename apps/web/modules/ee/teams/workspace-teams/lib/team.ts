import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { TWorkspaceTeam } from "@/modules/ee/teams/workspace-teams/types/team";

export const getTeamsByWorkspaceId = reactCache(
  async (workspaceId: string): Promise<TWorkspaceTeam[] | null> => {
    validateInputs([workspaceId, ZId]);
    try {
      const workspace = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

      if (!workspace) {
        throw new ResourceNotFoundError("Workspace", workspaceId);
      }

      const teams = await prisma.team.findMany({
        where: {
          workspaceTeams: {
            some: {
              workspaceId: workspaceId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          workspaceTeams: {
            where: {
              workspaceId: workspaceId,
            },
            select: {
              permission: true,
            },
          },
          _count: {
            select: {
              teamUsers: true,
            },
          },
        },
      });

      const workspaceTeams = teams.map((team) => ({
        id: team.id,
        name: team.name,
        permission: team.workspaceTeams[0].permission,
        memberCount: team._count.teamUsers,
      }));

      return workspaceTeams;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
