/**
 * V3 API auth — session (browser) or API key with environment-scoped access.
 */
import { ApiKeyPermission } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import type { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { problemForbidden, problemUnauthorized } from "./response";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

/** read/write/manage on an API key env all allow read-only list operations. */
function apiKeyPermissionAllowsList(permission: ApiKeyPermission): boolean {
  return (
    permission === ApiKeyPermission.read ||
    permission === ApiKeyPermission.write ||
    permission === ApiKeyPermission.manage
  );
}

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
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }
  if (!("user" in authentication) || !authentication.user?.id) {
    return problemUnauthorized(requestId, "Session required", instance);
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
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }
    if (err instanceof AuthorizationError) {
      log.warn({ statusCode: 403, errorCode: err.name }, "Forbidden");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }
    throw err;
  }
}

/**
 * Session or API key: authorize `workspaceId` for survey list (read).
 * API keys must list the workspace environment with read-equivalent permission.
 */
export async function requireV3WorkspaceAccess(
  authentication: TApiV1Authentication,
  workspaceId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  if ("user" in authentication && authentication.user?.id) {
    return requireSessionWorkspaceAccess(authentication, workspaceId, minPermission, requestId, instance);
  }

  const keyAuth = authentication as TAuthenticationApiKey;
  if (keyAuth.apiKeyId && Array.isArray(keyAuth.environmentPermissions)) {
    const perm = keyAuth.environmentPermissions.find((e) => e.environmentId === workspaceId);
    if (!perm || !apiKeyPermissionAllowsList(perm.permission)) {
      logger
        .withContext({ requestId, workspaceId })
        .warn({ statusCode: 403 }, "API key not allowed for workspace");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }
    return {
      environmentId: workspaceId,
      projectId: perm.projectId,
      organizationId: keyAuth.organizationId,
    };
  }

  return problemUnauthorized(requestId, "Not authenticated", instance);
}
