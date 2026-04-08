import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
import { responses } from "@/app/lib/api/response";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Given a request body that must contain workspaceId (or legacy environmentId),
 * validates workspace-level permission and returns the authorized body.
 *
 * Returns `{ body, alreadyAuthorized: true }` when workspace-level auth was used.
 * Returns an error response if authorization fails.
 */
export const resolveBodyIds = async <T extends Record<string, unknown>>(
  body: T,
  permissions: TAPIKeyWorkspacePermission[],
  method: HttpMethod
): Promise<
  | { ok: true; body: T & { workspaceId: string }; alreadyAuthorized: boolean }
  | { ok: false; response: Response }
> => {
  // Accept workspaceId or environmentId (legacy alias)
  const rawId = (body.workspaceId ?? body.environmentId) as string | undefined;

  if (!rawId) {
    return {
      ok: false,
      response: responses.badRequestResponse("workspaceId must be provided"),
    };
  }

  if (typeof rawId !== "string") {
    return { ok: false, response: responses.badRequestResponse("workspaceId must be a string") };
  }

  // Resolve to canonical workspace id (handles legacy environment IDs)
  const workspace = await findWorkspaceByIdOrLegacyEnvId(rawId);
  if (!workspace) {
    return { ok: false, response: responses.notFoundResponse("Workspace", rawId) };
  }

  const workspaceId = workspace.id;

  if (!hasPermission(permissions, workspaceId, method)) {
    return { ok: false, response: responses.unauthorizedResponse() };
  }

  return {
    ok: true,
    body: { ...body, workspaceId },
    alreadyAuthorized: true,
  };
};
