import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
import { responses } from "@/app/lib/api/response";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Given a request body that must contain workspaceId,
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
  if (!body.workspaceId) {
    return {
      ok: false,
      response: responses.badRequestResponse("workspaceId must be provided"),
    };
  }

  if (typeof body.workspaceId !== "string") {
    return { ok: false, response: responses.badRequestResponse("workspaceId must be a string") };
  }

  const workspaceId = body.workspaceId;

  if (!hasPermission(permissions, workspaceId, method)) {
    return { ok: false, response: responses.unauthorizedResponse() };
  }

  return {
    ok: true,
    body: { ...body, workspaceId },
    alreadyAuthorized: true,
  };
};
