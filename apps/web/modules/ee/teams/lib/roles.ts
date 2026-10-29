import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const getWorkspacePermissionByUserId = reactCache(
  async (userId: string, workspaceId: string): Promise<TTeamPermission | null> => {
    validateInputs([userId, ZString], [workspaceId, ZString]);

    try {
      const workspaceMemberships = await prisma.workspaceTeam.findMany({
        where: {
          workspaceId,
          team: {
            teamUsers: {
              some: {
                userId,
              },
            },
          },
        },
      });

      if (!workspaceMemberships) return null;
      let highestPermission: TTeamPermission | null = null;

      for (const membership of workspaceMemberships) {
        if (membership.permission === "manage") {
          highestPermission = "manage";
        } else if (membership.permission === "readWrite" && highestPermission !== "manage") {
          highestPermission = "readWrite";
        } else if (
          membership.permission === "read" &&
          highestPermission !== "manage" &&
          highestPermission !== "readWrite"
        ) {
          highestPermission = "read";
        }
      }

      return highestPermission;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching workspace permission by user id");
        throw new DatabaseError(error.message);
      }

      throw new UnknownError("Error while fetching membership");
    }
  }
);

export const getTeamsWhereUserIsAdmin = reactCache(
  async (userId: string, organizationId: string): Promise<string[]> => {
    validateInputs([userId, ZId], [organizationId, ZId]);
    try {
      const adminTeams = await prisma.teamUser.findMany({
        where: {
          userId,
          role: "admin",
          team: {
            organizationId,
          },
        },
        select: {
          teamId: true,
        },
      });

      return adminTeams.map((at) => at.teamId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
