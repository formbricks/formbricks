/**
 * V3 API workspace → internal IDs translation layer (retro-compatibility / future-proofing).
 *
 * Workspace is the default container for surveys. We are deprecating Environment and making
 * Workspace that container. In the API, workspaceId refers to that container.
 *
 * Today: workspaceId is mapped to environmentId (Environment is the current container for surveys).
 * When Environment is deprecated and Workspace exists: resolve workspaceId to the Workspace entity
 * (and derive environmentId or equivalent from it). Change only this file.
 */
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getEnvironment } from "@/lib/utils/services";

/**
 * Internal IDs derived from a V3 workspace identifier.
 * Today: environmentId is the workspace (Environment = container for surveys until Workspace exists).
 */
export type V3WorkspaceContext = {
  /** Environment ID — the container for surveys today. Replaced by workspace when Environment is deprecated. */
  environmentId: string;
  /** Workspace ID used for workspaceTeam auth. */
  workspaceId: string;
  /** Organization ID used for org-level auth. */
  organizationId: string;
};

/**
 * Resolves a V3 API workspaceId to internal environmentId, workspaceId, and organizationId.
 * Today: workspaceId is treated as environmentId (workspace = container for surveys = Environment).
 *
 * @throws ResourceNotFoundError if the workspace (environment) does not exist.
 */
export async function resolveV3WorkspaceContext(workspaceId: string): Promise<V3WorkspaceContext> {
  // Today: workspaceId is the environment id (survey container). Look it up.
  const environment = await getEnvironment(workspaceId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", workspaceId);
  }

  // Derive org for auth; workspace comes from the environment.
  const organizationId = await getOrganizationIdFromWorkspaceId(environment.workspaceId);

  // We looked up by workspaceId (as environment id), so the resolved environment id is workspaceId.
  return {
    environmentId: workspaceId,
    workspaceId: environment.workspaceId,
    organizationId,
  };
}
