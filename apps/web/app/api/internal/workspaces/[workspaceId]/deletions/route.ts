import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteWorkspaceOperation } from "../../lib/operations";
import { ZWorkspaceDeletionBody, ZWorkspaceIdParams } from "../../schemas";

/**
 * `POST /api/internal/workspaces/{workspaceId}/deletions`: delete the workspace, confirmed by its name. A
 * POST, not a DELETE: the confirmation is a request body, which a DELETE has no defined semantics for
 * (RFC 9110 §9.3.5).
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceIdParams, body: ZWorkspaceDeletionBody },
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
