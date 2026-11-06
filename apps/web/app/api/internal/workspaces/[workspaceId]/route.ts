import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateWorkspaceOperation } from "../lib/operations";
import { ZWorkspaceIdParams, ZWorkspacePatchBody } from "../schemas";

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
