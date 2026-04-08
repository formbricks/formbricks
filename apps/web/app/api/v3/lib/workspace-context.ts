/**
 * V3 API workspace → internal IDs translation layer.
 *
 * Workspace is the container for surveys. The workspaceId in the API
 * directly maps to the Workspace entity.
 */
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/utils/services";

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
 * Resolves a V3 API workspaceId to internal workspaceId and organizationId.
 *
 * @throws ResourceNotFoundError if the workspace does not exist.
 */
export async function resolveV3WorkspaceContext(workspaceId: string): Promise<V3WorkspaceContext> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError("workspace", workspaceId);
  }

  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  return {
    workspaceId,
    organizationId,
  };
}
