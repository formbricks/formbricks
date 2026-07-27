import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export type LegacyWorkspaceAction = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type WorkspacePermissionLevel = "read" | "readWrite" | "manage";

const ACTION_REQUIRED_PERMISSION: Record<LegacyWorkspaceAction, WorkspacePermissionLevel> = {
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
 * Database-backed implementation of the current workspace permission ladder.
 *
 * This is intentionally internal to the legacy evaluator. Public callers must
 * use the central authorization interface (directly or through the temporary
 * compatibility wrapper in `@/lib/workspace/auth`).
 */
export const hasUserWorkspaceAccessForActionLegacy = async (
  userId: string,
  workspaceId: string,
  action: LegacyWorkspaceAction
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

    const workspaceTeams = await prisma.workspaceTeam.findMany({
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

    if (workspaceTeams.length === 0) return false;

    const highestPermission = workspaceTeams.reduce<WorkspacePermissionLevel>(
      (max, workspaceTeam) =>
        PERMISSION_RANK[workspaceTeam.permission] > PERMISSION_RANK[max] ? workspaceTeam.permission : max,
      workspaceTeams[0].permission
    );

    return teamPermissionSatisfies(highestPermission, ACTION_REQUIRED_PERMISSION[action]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
