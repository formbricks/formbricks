import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateContactAttributesOperation } from "../../lib/operations";
import { ZContactAttributesBody, ZContactParams } from "../../schemas";

/**
 * `PUT /api/internal/contacts/{contactId}/attributes`: replace the contact's attributes with the ones sent.
 * Contacts-licence gated.
 */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactParams, body: ZContactAttributesBody },
  action: "updated",
  targetType: "contact",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateContactAttributesOperation({
      authentication,
      contactId: parsedInput.params.contactId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
