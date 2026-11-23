import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../schemas";
import { removeOrganizationEmailLogoOperation, updateOrganizationEmailLogoOperation } from "./lib/operations";
import { ZOrganizationEmailLogoPutBody } from "./schemas";

/** `PUT /api/internal/organizations/{organizationId}/email-logo`: the email customization's logo. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZOrganizationEmailLogoPutBody },
  action: "updated",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateOrganizationEmailLogoOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/organizations/{organizationId}/email-logo`: back to the Formbricks logo. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "updated",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    removeOrganizationEmailLogoOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
