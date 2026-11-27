import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../schemas";
import { removeOrganizationFaviconOperation, updateOrganizationFaviconOperation } from "./lib/operations";
import { ZOrganizationFaviconPutBody } from "./schemas";

/** `PUT /api/internal/organizations/{organizationId}/favicon`: the link surveys' favicon. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZOrganizationFaviconPutBody },
  action: "updated",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateOrganizationFaviconOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/organizations/{organizationId}/favicon`: back to the default favicon. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "updated",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    removeOrganizationFaviconOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
