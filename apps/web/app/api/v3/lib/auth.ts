/**
 * V3 API auth — session (browser) or API key with environment-scoped access.
 */
import { ApiKeyPermission } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import type { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

function apiKeyPermissionAllows(permission: ApiKeyPermission, minPermission: TTeamPermission): boolean {
  const grantedRank = {
    [ApiKeyPermission.read]: 1,
    [ApiKeyPermission.write]: 2,
    [ApiKeyPermission.manage]: 3,
  }[permission];

  const requiredRank = {
    read: 1,
    readWrite: 2,
    manage: 3,
  }[minPermission];

  return grantedRank >= requiredRank;
}

/**
 * Require session and workspace access. workspaceId is resolved via the V3 workspace-context layer.
 * Returns a Response (401 or 403) on failure, or the resolved workspace context on success so callers
 * use internal IDs (environmentId, projectId, organizationId) without resolving again.
 * We use 403 (not 404) when the workspace is not found to avoid leaking resource existence.
 */
export async function requireSessionWorkspaceAccess(
  authentication: TV3Authentication,
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
    if (err instanceof ResourceNotFoundError || err instanceof AuthorizationError) {
      const message = err instanceof ResourceNotFoundError ? "Workspace not found" : "Forbidden";
      log.warn({ statusCode: 403, errorCode: err.name }, message);
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }
    throw err;
  }
}

/** Session or API key: authorize `workspaceId` against the resolved V3 workspace context. */
export async function requireV3WorkspaceAccess(
  authentication: TV3Authentication,
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
    const log = logger.withContext({ requestId, workspaceId, apiKeyId: keyAuth.apiKeyId });

    try {
      const context = await resolveV3WorkspaceContext(workspaceId);
      const permission = keyAuth.environmentPermissions.find(
        (environmentPermission) => environmentPermission.environmentId === context.environmentId
      );

      if (!permission || !apiKeyPermissionAllows(permission.permission, minPermission)) {
        log.warn({ statusCode: 403 }, "API key not allowed for workspace");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      return context;
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        log.warn({ statusCode: 403, errorCode: error.name }, "Workspace not found");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      throw error;
    }
  }

  return problemUnauthorized(requestId, "Not authenticated", instance);
}
