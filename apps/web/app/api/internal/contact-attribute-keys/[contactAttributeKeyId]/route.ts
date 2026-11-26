import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteContactAttributeKeyOperation, updateContactAttributeKeyOperation } from "../lib/operations";
import { ZContactAttributeKeyParams, ZUpdateContactAttributeKeyBody } from "../schemas";

/** `PATCH /api/internal/contact-attribute-keys/{contactAttributeKeyId}`: relabel a custom key. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactAttributeKeyParams, body: ZUpdateContactAttributeKeyBody },
  action: "updated",
  targetType: "contactAttributeKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateContactAttributeKeyOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/contact-attribute-keys/{contactAttributeKeyId}`: delete a custom key. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactAttributeKeyParams },
  action: "deleted",
  targetType: "contactAttributeKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteContactAttributeKeyOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      requestId,
      instance,
      auditLog,
    }),
});
