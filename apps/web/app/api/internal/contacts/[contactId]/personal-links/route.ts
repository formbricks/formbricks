import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createContactPersonalLinkOperation } from "../../lib/operations";
import { ZContactParams, ZContactPersonalLinkBody } from "../../schemas";

/**
 * `POST /api/internal/contacts/{contactId}/personal-links`: a personal link to a survey for the contact.
 * Contacts-licence gated.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactParams, body: ZContactPersonalLinkBody },
  action: "created",
  targetType: "contact",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createContactPersonalLinkOperation({
      authentication,
      contactId: parsedInput.params.contactId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
