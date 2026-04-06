import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getProductionEnvironmentIdByWorkspaceId } from "@/modules/api/v2/management/lib/helper";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission, hasWorkspacePermission } from "@/modules/organization/settings/api-keys/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Resolves workspaceId or environmentId for v2 management routes, checking permissions accordingly.
 *
 * - If `workspaceId` is provided (without `environmentId`): resolves + checks workspace permission.
 * - If `environmentId` is provided (without `workspaceId`): checks environment permission.
 * - If both are provided: returns an error.
 * - If neither is provided: returns an error.
 *
 * On success, returns the resolved `environmentId` and `workspaceId`.
 */
export const resolveBodyIdsV2 = async (
  body: { workspaceId?: string; environmentId?: string },
  permissions: TAPIKeyEnvironmentPermission[],
  method: HttpMethod
): Promise<Result<{ environmentId: string; workspaceId: string }, ApiErrorResponseV2>> => {
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

    return ok({ environmentId: envResult.data, workspaceId: body.workspaceId });
  }

  if (body.environmentId) {
    const perm = permissions.find((p) => p.environmentId === body.environmentId);
    if (!perm || !hasPermission(permissions, perm.workspaceId, method)) {
      return err({ type: "forbidden" });
    }

    return ok({ environmentId: body.environmentId, workspaceId: perm.workspaceId });
  }

  return err({
    type: "bad_request",
    details: [{ field: "environmentId", issue: "Either environmentId or workspaceId must be provided" }],
  });
};
