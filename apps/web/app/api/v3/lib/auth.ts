/**
 * V3 app API session auth — require session + workspace access.
 * workspaceId is resolved via workspace-context (today: workspaceId = environmentId).
 * No environmentId in the API contract; callers only pass workspaceId.
 */
import { logger } from "@formbricks/logger";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import type { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { problem401, problem403 } from "./response";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

/**
 * Require session and workspace access. workspaceId is resolved via the V3 workspace-context layer.
 * Returns a Response (401 or 403) on failure, or the resolved workspace context on success so callers
 * use internal IDs (environmentId, projectId, organizationId) without resolving again.
 * We use 403 (not 404) when the workspace is not found to avoid leaking resource existence.
 */
export async function requireSessionWorkspaceAccess(
  authentication: TApiV1Authentication,
  workspaceId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  // --- Session checks ---
  if (!authentication) {
    return problem401(requestId, "Not authenticated", instance);
  }
  if (!("user" in authentication) || !authentication.user?.id) {
    return problem401(requestId, "Session required", instance);
  }

  const userId = authentication.user.id;
  const log = logger.withContext({ requestId, workspaceId });

  try {
    // Resolve workspaceId → environmentId, projectId, organizationId (single place to change when Workspace exists).
    const context = await resolveV3WorkspaceContext(workspaceId);

    // Org + project-team access; we use internal IDs from context.
    await checkAuthorizationUpdated({
      userId,
      organizationId: context.organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "projectTeam", projectId: context.projectId, minPermission },
      ],
    });

    return context;
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      // Return 403 (not 404) so we don't leak whether the workspace exists to unauthenticated or unauthorized callers.
      log.warn({ statusCode: 403, errorCode: err.name }, "Workspace not found");
      return problem403(requestId, "You are not authorized to access this resource", instance);
    }
    if (err instanceof AuthorizationError) {
      log.warn({ statusCode: 403, errorCode: err.name }, "Forbidden");
      return problem403(requestId, "You are not authorized to access this resource", instance);
    }
    throw err;
  }
}
