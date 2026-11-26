import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateWorkspaceBrandingOperation } from "./lib/operations";
import { ZWorkspaceBrandingParams, ZWorkspaceBrandingPatchBody } from "./schemas";

/** `PATCH /api/internal/workspaces/{workspaceId}/branding`: the Look & Feel page's branding toggles. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkspaceBrandingParams, body: ZWorkspaceBrandingPatchBody },
  action: "updated",
  targetType: "workspace",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateWorkspaceBrandingOperation({
      authentication,
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
