import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Resolves workspaceId for v2 management routes, checking permissions accordingly.
 *
 * - Accepts `workspaceId` or `environmentId` (legacy alias).
 * - Resolves legacy environment IDs to canonical workspace IDs.
 * - If not provided: returns an error.
 *
 * On success, returns the resolved `workspaceId`.
 */
export const resolveBodyIdsV2 = async (
  body: { workspaceId?: string; environmentId?: string },
  authentication: TAuthenticationApiKey,
  method: HttpMethod
): Promise<Result<{ workspaceId: string }, ApiErrorResponseV2>> => {
  const rawId = body.workspaceId ?? body.environmentId;

  if (rawId) {
    const workspace = await findWorkspaceByIdOrLegacyEnvId(rawId);
    if (!workspace) {
      return err({
        type: "not_found",
        details: [{ field: "workspaceId", issue: "workspace not found" }],
      });
    }

    // ENG-1749 defense-in-depth: even if the API key somehow carries a permission row for this
    // workspace, refuse it unless the workspace belongs to the key's own organization. This is a
    // second, independent tenant boundary behind the create-time check in createApiKey.
    if (workspace.organizationId !== authentication.organizationId) {
      return err({ type: "forbidden" });
    }

    if (
      !(await can(
        { type: "apiKey", id: authentication.apiKeyId },
        getWorkspaceAuthorizationActionForMethod(method),
        { type: "workspace", id: workspace.id }
      ))
    ) {
      return err({ type: "forbidden" });
    }

    return ok({ workspaceId: workspace.id });
  }

  return err({
    type: "bad_request",
    details: [{ field: "workspaceId", issue: "workspaceId must be provided" }],
  });
};
