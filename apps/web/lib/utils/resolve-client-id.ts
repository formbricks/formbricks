import "server-only";
import { cache as reactCache } from "react";
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
 *
 * Both lookups run in parallel to avoid sequential round-trips on every request.
 */
export const resolveClientApiIds = reactCache(async (id: string): Promise<TResolvedClientIds | null> => {
  const [environment, workspace] = await Promise.all([
    prisma.environment.findUnique({
      where: { id },
      select: { id: true, workspaceId: true },
    }),
    prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        environments: {
          where: { type: "production" },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  if (environment) {
    return { workspaceId: environment.workspaceId, environmentId: environment.id };
  }

  if (workspace?.environments[0]) {
    return { workspaceId: workspace.id, environmentId: workspace.environments[0].id };
  }

  return null;
});
