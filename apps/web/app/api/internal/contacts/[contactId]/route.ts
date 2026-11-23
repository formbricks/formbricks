import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteContactOperation } from "../lib/operations";
import { ZContactParams } from "../schemas";

/**
 * `DELETE /api/internal/contacts/{contactId}`: delete a contact. Contacts-licence gated. Listing contacts is
 * `GET /api/v3/contacts`.
 */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactParams },
  action: "deleted",
  targetType: "contact",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteContactOperation({
      authentication,
      contactId: parsedInput.params.contactId,
      requestId,
      instance,
      auditLog,
    }),
});
