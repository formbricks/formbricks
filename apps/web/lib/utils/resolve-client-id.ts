import "server-only";
import { prisma } from "@formbricks/database";

export type TResolvedClientIds = {
  workspaceId: string;
  environmentId: string;
};

/**
 * Resolves a URL parameter that may be an environmentId (old SDK) or workspaceId (new SDK).
 *
 * - If the id matches an Environment, returns the environment's id and its parent workspaceId.
 * - If not, checks the Workspace table and returns the workspace's production environment id.
 * - Returns null if neither lookup succeeds.
 */
export const resolveClientApiIds = async (id: string): Promise<TResolvedClientIds | null> => {
  // Try as environmentId first (existing SDKs)
  const environment = await prisma.environment.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });

  if (environment) {
    return { workspaceId: environment.workspaceId, environmentId: environment.id };
  }

  // Try as workspaceId (new SDKs sending workspaceId)
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      environments: {
        where: { type: "production" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (workspace && workspace.environments[0]) {
    return { workspaceId: workspace.id, environmentId: workspace.environments[0].id };
  }

  return null;
};
