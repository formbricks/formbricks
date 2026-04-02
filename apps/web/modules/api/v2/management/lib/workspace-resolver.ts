import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getProductionEnvironmentIdByWorkspaceId } from "@/modules/api/v2/management/lib/helper";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission, hasWorkspacePermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Resolves workspaceId → production environmentId for v2 management routes.
 *
 * - If `workspaceId` is provided (without `environmentId`): resolves + checks workspace permission.
 * - If `environmentId` is provided (without `workspaceId`): checks environment permission.
 * - If both are provided: returns an error.
 * - If neither is provided: returns an error.
 *
 * On success, returns the resolved `environmentId`.
 */
export const resolveWorkspaceInBodyV2 = async (
  body: { workspaceId?: string; environmentId?: string },
  permissions: TAPIKeyEnvironmentPermission[],
  method: HttpMethod
): Promise<Result<string, ApiErrorResponseV2>> => {
  if (body.workspaceId && body.environmentId) {
    return err({
      type: "bad_request",
      details: [{ field: "environmentId", issue: "Provide either environmentId or workspaceId, not both" }],
    });
  }

  if (body.workspaceId && !body.environmentId) {
    if (!hasWorkspacePermission(permissions, body.workspaceId, method)) {
      return err({ type: "forbidden" });
    }

    const envResult = await getProductionEnvironmentIdByWorkspaceId(body.workspaceId);
    if (!envResult.ok) {
      return err(envResult.error);
    }

    return ok(envResult.data);
  }

  if (body.environmentId) {
    if (!hasPermission(permissions, body.environmentId, method)) {
      return err({ type: "forbidden" });
    }

    return ok(body.environmentId);
  }

  return err({
    type: "bad_request",
    details: [{ field: "environmentId", issue: "Either environmentId or workspaceId must be provided" }],
  });
};
