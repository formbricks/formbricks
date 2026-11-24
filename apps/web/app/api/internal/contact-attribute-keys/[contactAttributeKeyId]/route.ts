import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteContactAttributeKeyOperation, updateContactAttributeKeyOperation } from "../lib/operations";
import {
  ZContactAttributeKeyParams,
  ZContactAttributeKeyWorkspaceQuery,
  ZUpdateContactAttributeKeyBody,
} from "../schemas";

/** `PATCH /api/internal/contact-attribute-keys/{contactAttributeKeyId}?workspaceId=`: relabel a custom key. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: {
    params: ZContactAttributeKeyParams,
    query: ZContactAttributeKeyWorkspaceQuery,
    body: ZUpdateContactAttributeKeyBody,
  },
  action: "updated",
  targetType: "contactAttributeKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateContactAttributeKeyOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/contact-attribute-keys/{contactAttributeKeyId}?workspaceId=`: delete a custom key. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactAttributeKeyParams, query: ZContactAttributeKeyWorkspaceQuery },
  action: "deleted",
  targetType: "contactAttributeKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteContactAttributeKeyOperation({
      authentication,
      contactAttributeKeyId: parsedInput.params.contactAttributeKeyId,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
      auditLog,
    }),
});
