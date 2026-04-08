import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Resolves workspaceId for v2 management routes, checking permissions accordingly.
 *
 * - If `workspaceId` is provided: checks workspace permission.
 * - If not provided: returns an error.
 *
 * On success, returns the resolved `workspaceId`.
 */
export const resolveBodyIdsV2 = async (
  body: { workspaceId?: string },
  permissions: TAPIKeyWorkspacePermission[],
  method: HttpMethod
): Promise<Result<{ workspaceId: string }, ApiErrorResponseV2>> => {
  if (body.workspaceId) {
    if (!hasPermission(permissions, body.workspaceId, method)) {
      return err({ type: "forbidden" });
    }

    return ok({ workspaceId: body.workspaceId });
  }

  return err({
    type: "bad_request",
    details: [{ field: "workspaceId", issue: "workspaceId must be provided" }],
  });
};
