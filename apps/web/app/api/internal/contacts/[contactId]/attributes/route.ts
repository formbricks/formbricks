import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateContactAttributesOperation } from "../../lib/operations";
import { ZContactAttributesBody, ZContactParams, ZContactWorkspaceQuery } from "../../schemas";

/**
 * `PUT /api/internal/contacts/{contactId}/attributes?workspaceId=`: replace the contact's attributes with the
 * ones sent; the contact must be in the workspace's contact directory.
 * Contacts-licence gated.
 */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactParams, query: ZContactWorkspaceQuery, body: ZContactAttributesBody },
  action: "updated",
  targetType: "contact",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateContactAttributesOperation({
      authentication,
      contactId: parsedInput.params.contactId,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
