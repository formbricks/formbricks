import "server-only";
import { prisma } from "@formbricks/database";

export type TResolvedClientIds = {
  projectId: string;
  environmentId: string;
};

/**
 * Resolves a URL parameter that may be an environmentId (old SDK) or projectId (new SDK).
 *
 * - If the id matches an Environment, returns the environment's id and its parent projectId.
 * - If not, checks the Project table and returns the project's production environment id.
 * - Returns null if neither lookup succeeds.
 */
export const resolveClientApiIds = async (id: string): Promise<TResolvedClientIds | null> => {
  // Try as environmentId first (existing SDKs)
  const environment = await prisma.environment.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });

  if (environment) {
    return { projectId: environment.projectId, environmentId: environment.id };
  }

  // Try as projectId (new SDKs sending workspaceId/projectId)
  const project = await prisma.project.findUnique({
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

  if (project && project.environments[0]) {
    return { projectId: project.id, environmentId: project.environments[0].id };
  }

  return null;
};
