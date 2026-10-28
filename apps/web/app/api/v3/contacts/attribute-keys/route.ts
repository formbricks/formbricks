/**
 * POST /api/v3/contacts/attribute-keys — define a contact attribute key (with an optional data type).
 * Reading keys is `GET /api/v3/contact-attribute-keys`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createV3ContactAttributeKey } from "../lib/attribute-key-operations";
import { ZV3CreateContactAttributeKeyBody } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "contactAttributeKey",
  schemas: { body: ZV3CreateContactAttributeKeyBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3ContactAttributeKey({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
