import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export type TResolvedClientIds = {
  workspaceId: string;
};

/**
 * Resolves a URL parameter that is a workspaceId.
 *
 * - Looks up the id in the Workspace table and returns the workspaceId.
 * - Returns null if the lookup fails.
 */
export const resolveClientApiIds = reactCache(async (id: string): Promise<TResolvedClientIds | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true },
  });

  if (workspace) {
    return { workspaceId: workspace.id };
  }

  return null;
});
