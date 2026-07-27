import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import type { LegacyWorkspaceAction } from "@/lib/authorization/legacy-workspace-access";
import { validateInputs } from "../utils/validate";

export type WorkspaceAction = LegacyWorkspaceAction;

const ACTION_PERMISSION = {
  GET: "workspace.read",
  POST: "workspace.write",
  PUT: "workspace.write",
  PATCH: "workspace.write",
  DELETE: "workspace.manage",
} as const satisfies Record<WorkspaceAction, "workspace.read" | "workspace.write" | "workspace.manage">;

/**
 * Compatibility wrapper for action-aware workspace access.
 *
 * @deprecated New authorization-sensitive code must call `can` or `assertCan`
 * with the semantic workspace action directly.
 */
export const hasUserWorkspaceAccessForAction = async (
  userId: string,
  workspaceId: string,
  action: WorkspaceAction
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspaceId, ZId]);

  return can({ type: "user", id: userId }, ACTION_PERMISSION[action], { type: "workspace", id: workspaceId });
};

/**
 * Navigation/layout compatibility check.
 *
 * @deprecated This helper is not action-aware and intentionally includes the
 * billing role. Do not use it for new data-access or mutation authorization;
 * migrate remaining callers under ENG-1737.
 */
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
