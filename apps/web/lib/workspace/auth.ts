import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
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

    // A user can belong to multiple teams that each grant access to the same
    // workspace at different permission levels (the WorkspaceTeam unique key
    // is [workspaceId, teamId], not [workspaceId, userId]). Pick the highest
    // level so a `read` team membership doesn't shadow a `manage` one.
    const highestPermission = workspaceTeams.reduce<WorkspacePermissionLevel>(
      (max, wt) => (PERMISSION_RANK[wt.permission] > PERMISSION_RANK[max] ? wt.permission : max),
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

/**
 * Authorization for the integration OAuth routes (Notion / Airtable / Slack / Google Sheets).
 *
 * These are credential *mutations* delivered over GET: completing the flow writes the workspace's
 * third-party credentials, after which survey responses are forwarded to whichever account was
 * connected. They must therefore be gated on readWrite, not on mere workspace access —
 * {@link hasUserWorkspaceAccess} returns true for the `billing` role (which is otherwise excluded from
 * all product data) and for a `read`-only team member, either of whom could otherwise bind their own
 * account as the workspace integration and start receiving another team's responses, or overwrite the
 * credentials an admin configured.
 */
export const canUserWriteWorkspaceIntegrations = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => hasUserWorkspaceAccessForAction(userId, workspaceId, "POST");

/**
 * Read-only counterpart for routes that only surface a connected integration's data. Unlike
 * {@link hasUserWorkspaceAccess} this still excludes the `billing` role.
 */
export const canUserReadWorkspaceIntegrations = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => hasUserWorkspaceAccessForAction(userId, workspaceId, "GET");

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
