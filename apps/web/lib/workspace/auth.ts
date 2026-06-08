import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";

export type WorkspaceAction = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type WorkspacePermissionLevel = "read" | "readWrite" | "manage";

const ACTION_REQUIRED_PERMISSION: Record<WorkspaceAction, WorkspacePermissionLevel> = {
  GET: "read",
  POST: "readWrite",
  PUT: "readWrite",
  PATCH: "readWrite",
  DELETE: "manage",
};

const PERMISSION_RANK: Record<WorkspacePermissionLevel, number> = {
  read: 0,
  readWrite: 1,
  manage: 2,
};

const teamPermissionSatisfies = (
  teamPermission: WorkspacePermissionLevel,
  required: WorkspacePermissionLevel
): boolean => PERMISSION_RANK[teamPermission] >= PERMISSION_RANK[required];

/**
 * Action-aware workspace access check for session-authenticated users.
 *
 * - Billing role: never authorized — billing users are excluded from product data surfaces.
 * - Owner / manager: always authorized.
 * - Member: authorized only when a WorkspaceTeam grants a permission level that
 *   meets or exceeds the action's required level (read for GET, readWrite for
 *   POST/PUT/PATCH, manage for DELETE).
 *
 * The broader {@link hasUserWorkspaceAccess} helper does not gate by action and
 * should not be used for routes that mutate or expose workspace data.
 */
export const hasUserWorkspaceAccessForAction = async (
  userId: string,
  workspaceId: string,
  action: WorkspaceAction
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspaceId, ZId]);

  try {
    const orgMembership = await prisma.membership.findFirst({
      where: {
        userId,
        organization: {
          workspaces: {
            some: { id: workspaceId },
          },
        },
      },
    });

    if (!orgMembership) return false;
    if (orgMembership.role === "billing") return false;
    if (orgMembership.role === "owner" || orgMembership.role === "manager") return true;

    const workspaceTeam = await prisma.workspaceTeam.findFirst({
      where: {
        workspaceId,
        team: {
          teamUsers: {
            some: { userId },
          },
        },
      },
      select: { permission: true },
    });

    if (!workspaceTeam) return false;

    return teamPermissionSatisfies(workspaceTeam.permission, ACTION_REQUIRED_PERMISSION[action]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const hasUserWorkspaceAccess = async (userId: string, workspaceId: string) => {
  validateInputs([userId, ZId], [workspaceId, ZId]);

  try {
    const orgMembership = await prisma.membership.findFirst({
      where: {
        userId,
        organization: {
          workspaces: {
            some: {
              id: workspaceId,
            },
          },
        },
      },
    });

    if (!orgMembership) return false;

    if (
      orgMembership.role === "owner" ||
      orgMembership.role === "manager" ||
      orgMembership.role === "billing"
    )
      return true;

    const teamMembership = await prisma.teamUser.findFirst({
      where: {
        userId,
        team: {
          workspaceTeams: {
            some: {
              workspaceId,
            },
          },
        },
      },
    });

    if (teamMembership) return true;

    return false;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
