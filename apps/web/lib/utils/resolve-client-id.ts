import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export type TResolvedClientIds = {
  workspaceId: string;
};

/**
 * Finds a workspace by its primary id or by legacyEnvironmentId.
 * Returns the workspace id if found, null otherwise.
 */
export const findWorkspaceByIdOrLegacyEnvId = async (id: string): Promise<{ id: string } | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true },
  });

  if (workspace) return workspace;

  // Fallback: the id may be a legacy environmentId
  return await prisma.workspace.findUnique({
    where: { legacyEnvironmentId: id },
    select: { id: true },
  });
};

/**
 * Resolves a URL parameter that may be a workspaceId or a legacy environmentId.
 *
 * - Looks up the id in the Workspace table by primary key first.
 * - Falls back to a lookup by legacyEnvironmentId for backward compatibility.
 * - Returns null if both lookups fail.
 */
export const resolveClientApiIds = reactCache(async (id: string): Promise<TResolvedClientIds | null> => {
  const workspace = await findWorkspaceByIdOrLegacyEnvId(id);

  if (workspace) {
    return { workspaceId: workspace.id };
  }

  return null;
});
