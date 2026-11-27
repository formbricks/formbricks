import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createContactAttributeKeyOperation } from "./lib/operations";
import { ZCreateContactAttributeKeyBody } from "./schemas";

/**
 * `POST /api/internal/contact-attribute-keys`: add a custom attribute key to the workspace the body names.
 * Contacts-licence gated. Listing keys is `GET /api/v3/contact-attribute-keys`.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZCreateContactAttributeKeyBody },
  action: "created",
  targetType: "contactAttributeKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createContactAttributeKeyOperation({
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
