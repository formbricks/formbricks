/**
 * V3 API auth — session (browser) or API key with environment-scoped access.
 */
import { ApiKeyPermission } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import type { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getSurvey } from "@/modules/survey/lib/survey";
import { problemForbidden, problemNotFound, problemUnauthorized } from "./response";
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

export type V3SurveyContext = V3WorkspaceContext & {
  survey: TSurvey;
};

async function authorizeSessionWorkspaceContext(
  authentication: TV3Authentication,
  context: V3WorkspaceContext,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  if (!("user" in authentication) || !authentication.user?.id) {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  const log = logger.withContext({ requestId, workspaceId: context.environmentId });

  try {
    await checkAuthorizationUpdated({
      userId: authentication.user.id,
      organizationId: context.organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "projectTeam", projectId: context.projectId, minPermission },
      ],
    });

    return context;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      log.warn({ statusCode: 403, errorCode: err.name }, "Forbidden");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    throw err;
  }
}

function authorizeApiKeyWorkspaceContext(
  authentication: TAuthenticationApiKey,
  context: V3WorkspaceContext,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Response | V3WorkspaceContext {
  const log = logger.withContext({
    requestId,
    workspaceId: context.environmentId,
    apiKeyId: authentication.apiKeyId,
  });

  const permission = authentication.environmentPermissions.find(
    (environmentPermission) => environmentPermission.environmentId === context.environmentId
  );

  if (!permission || !apiKeyPermissionAllows(permission.permission, minPermission)) {
    log.warn({ statusCode: 403 }, "API key not allowed for workspace");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  return context;
}

async function authorizeV3WorkspaceContext(
  authentication: TV3Authentication,
  context: V3WorkspaceContext,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  if ("user" in authentication && authentication.user?.id) {
    return await authorizeSessionWorkspaceContext(
      authentication,
      context,
      minPermission,
      requestId,
      instance
    );
  }

  if ("apiKeyId" in authentication && Array.isArray(authentication.environmentPermissions)) {
    return authorizeApiKeyWorkspaceContext(authentication, context, minPermission, requestId, instance);
  }

  return problemUnauthorized(requestId, "Not authenticated", instance);
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
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }
  if (!("user" in authentication) || !authentication.user?.id) {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  try {
    const context = await resolveV3WorkspaceContext(workspaceId);
    return await authorizeSessionWorkspaceContext(
      authentication,
      context,
      minPermission,
      requestId,
      instance
    );
  } catch (err) {
    const log = logger.withContext({ requestId, workspaceId });
    if (err instanceof ResourceNotFoundError) {
      log.warn({ statusCode: 403, errorCode: err.name }, "Workspace not found");
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
  try {
    const context = await resolveV3WorkspaceContext(workspaceId);
    return await authorizeV3WorkspaceContext(authentication, context, minPermission, requestId, instance);
  } catch (error) {
    const log = logger.withContext({ requestId, workspaceId });
    if (error instanceof ResourceNotFoundError) {
      log.warn({ statusCode: 403, errorCode: error.name }, "Workspace not found");
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    throw error;
  }
}

export async function requireV3SurveyAccess(
  authentication: TV3Authentication,
  surveyId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3SurveyContext> {
  try {
    const survey = await getSurvey(surveyId);
    if (!survey) {
      return problemNotFound(requestId, "Survey", surveyId, instance);
    }

    const workspaceAccess = await requireV3WorkspaceAccess(
      authentication,
      survey.environmentId,
      minPermission,
      requestId,
      instance
    );

    if (workspaceAccess instanceof Response) {
      return workspaceAccess;
    }

    return {
      ...workspaceAccess,
      survey,
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return problemNotFound(requestId, "Survey", surveyId, instance);
    }

    throw error;
  }
}
