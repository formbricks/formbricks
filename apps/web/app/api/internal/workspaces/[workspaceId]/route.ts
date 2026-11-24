import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getEditorWorkspaceOperation, updateWorkspaceOperation } from "../lib/operations";
import { ZWorkspaceIdParams, ZWorkspacePatchBody } from "../schemas";

/**
 * `GET /api/internal/workspaces/{workspaceId}`: the workspace without its custom CSS, for the survey editor
 * to refresh its state when its tab comes back into view. `workspace.write`, as before.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getEditorWorkspaceOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      requestId,
      instance,
    }),
});

/** `PATCH /api/internal/workspaces/{workspaceId}`: the workspace settings pages' edits. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceIdParams, body: ZWorkspacePatchBody },
  action: "updated",
  targetType: "workspace",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateWorkspaceOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
