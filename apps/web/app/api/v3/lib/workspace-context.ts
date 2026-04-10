/**
 * V3 API workspace → internal IDs translation layer.
 *
 * Workspace is the container for surveys. The workspaceId in the API
 * directly maps to the Workspace entity.
 */
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";

/**
 * Internal IDs derived from a V3 workspace identifier.
 */
export type V3WorkspaceContext = {
  /** Workspace ID — the container for surveys. */
  workspaceId: string;
  /** Organization ID used for org-level auth. */
  organizationId: string;
};

/**
 * Resolves a V3 API workspaceId (or legacy environmentId) to internal workspaceId and organizationId.
 *
 * @throws ResourceNotFoundError if the workspace does not exist.
 */
export async function resolveV3WorkspaceContext(workspaceId: string): Promise<V3WorkspaceContext> {
  const workspace = await findWorkspaceByIdOrLegacyEnvId(workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError("workspace", workspaceId);
  }

  const canonicalId = workspace.id;
  const organizationId = await getOrganizationIdFromWorkspaceId(canonicalId);

  return {
    workspaceId: canonicalId,
    organizationId,
  };
}
