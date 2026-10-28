import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteWorkspaceOperation, updateWorkspaceOperation } from "../lib/operations";
import { ZWorkspaceDeleteBody, ZWorkspaceIdParams, ZWorkspacePatchBody } from "../schemas";

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

/** `DELETE /api/internal/workspaces/{workspaceId}`: delete the workspace, confirmed by its name. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceIdParams, body: ZWorkspaceDeleteBody },
  action: "deleted",
  targetType: "workspace",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteWorkspaceOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
