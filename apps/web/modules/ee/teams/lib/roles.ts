import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { validateInputs } from "@/lib/utils/validate";
import { TTeamRole } from "@/modules/ee/teams/team-list/types/team";
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

/**
 * Lists the ids of every workspace a user can reach within an organization.
 *
 * Org owners/managers can reach all workspaces in the organization. Other roles (member) can
 * reach a workspace only through a team they belong to (any permission level counts as access).
 * Billing users — and users with no membership — reach nothing.
 *
 * Mirrors the role-aware access rule used by `getWorkspacesByUserId`, exposed as a plain id list
 * for org-scoped Unify Feedback authorization (which needs the set without a membership object).
 */
export const getAccessibleWorkspaceIds = reactCache(
  async (userId: string, organizationId: string): Promise<string[]> => {
    validateInputs([userId, ZId], [organizationId, ZId]);

    try {
      const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
      if (!membership) return [];

      const { isOwner, isManager } = getAccessFlags(membership.role);

      if (isOwner || isManager) {
        const workspaces = await prisma.workspace.findMany({
          where: { organizationId },
          select: { id: true },
        });
        return workspaces.map((workspace) => workspace.id);
      }

      const workspaceTeams = await prisma.workspaceTeam.findMany({
        where: {
          workspace: { organizationId },
          team: { teamUsers: { some: { userId } } },
        },
        select: { workspaceId: true },
        distinct: ["workspaceId"],
      });
      return workspaceTeams.map((workspaceTeam) => workspaceTeam.workspaceId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error fetching accessible workspace ids");
        throw new DatabaseError(error.message);
      }
      throw new UnknownError("Error while fetching accessible workspaces");
    }
  }
);

export const getTeamRoleByTeamIdUserId = reactCache(
  async (teamId: string, userId: string): Promise<TTeamRole | null> => {
    validateInputs([teamId, ZId], [userId, ZId]);
    try {
      const teamUser = await prisma.teamUser.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      if (!teamUser) {
        return null;
      }

      return teamUser.role;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
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
