import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { responses } from "@/app/lib/api/response";
import { getProductionEnvironmentIdByWorkspaceId as resolveFromV2 } from "@/modules/api/v2/management/lib/helper";
import { hasPermission, hasWorkspacePermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Resolves a workspaceId to its production environment's ID (simple wrapper for v1 routes).
 */
export const getProductionEnvironmentIdByWorkspaceId = async (
  workspaceId: string
): Promise<string | null> => {
  const result = await resolveFromV2(workspaceId);
  return result.ok ? result.data : null;
};

/**
 * Given a raw request body that may contain workspaceId instead of environmentId,
 * resolves the environment, checks permissions, and returns a normalized body
 * with environmentId guaranteed to be present.
 *
 * Returns `{ body, alreadyAuthorized: true }` when workspace-level auth was used,
 * or `{ body, alreadyAuthorized: false }` when the caller still needs to check env-level permission.
 * Returns an error response if authorization or resolution fails.
 */
export const resolveWorkspaceInBody = async <T extends Record<string, unknown>>(
  body: T,
  permissions: TAPIKeyEnvironmentPermission[],
  method: HttpMethod
): Promise<
  | { ok: true; body: T & { environmentId: string }; alreadyAuthorized: boolean }
  | { ok: false; response: Response }
> => {
  if (body.workspaceId && body.environmentId) {
    return {
      ok: false,
      response: responses.badRequestResponse("Provide either environmentId or workspaceId, not both"),
    };
  }

  if (body.workspaceId && !body.environmentId) {
    if (typeof body.workspaceId !== "string") {
      return { ok: false, response: responses.badRequestResponse("workspaceId must be a string") };
    }
    const workspaceId = body.workspaceId;

    if (!hasWorkspacePermission(permissions, workspaceId, method)) {
      return { ok: false, response: responses.unauthorizedResponse() };
    }

    const resolvedEnvId = await getProductionEnvironmentIdByWorkspaceId(workspaceId);
    if (!resolvedEnvId) {
      return { ok: false, response: responses.notFoundResponse("Workspace", workspaceId) };
    }

    return {
      ok: true,
      body: { ...body, environmentId: resolvedEnvId },
      alreadyAuthorized: true,
    };
  }

  return {
    ok: true,
    body: body as T & { environmentId: string },
    alreadyAuthorized: false,
  };
};

/**
 * Checks environment-level permission, but only if the request was not already
 * authorized at the workspace level.
 */
export const checkEnvPermissionIfNeeded = (
  alreadyAuthorized: boolean,
  permissions: TAPIKeyEnvironmentPermission[],
  environmentId: string,
  method: HttpMethod
): Response | null => {
  if (alreadyAuthorized) return null;
  if (!hasPermission(permissions, environmentId, method)) {
    return responses.unauthorizedResponse();
  }
  return null;
};
