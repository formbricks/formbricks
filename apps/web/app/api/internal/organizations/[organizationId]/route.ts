import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteOrganizationOperation, updateOrganizationOperation } from "../lib/operations";
import { ZOrganizationIdParams, ZOrganizationPatchBody } from "../schemas";

/** `PATCH /api/internal/organizations/{organizationId}`: the general settings page's edits. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZOrganizationPatchBody },
  action: "updated",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateOrganizationOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/organizations/{organizationId}`: delete the organization and its workspaces. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "deleted",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteOrganizationOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
