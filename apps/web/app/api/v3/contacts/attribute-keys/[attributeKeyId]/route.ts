/**
 * /api/v3/contacts/attribute-keys/{attributeKeyId}
 *   PATCH  — rename or describe a custom attribute key.
 *   DELETE — delete a custom attribute key and every contact's value for it.
 *
 * The workspace is resolved from the key. Default keys (userId, email, ...) are refused with a 422.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3ContactAttributeKey, updateV3ContactAttributeKey } from "../../lib/attribute-key-operations";
import { ZV3ContactAttributeKeyIdParams, ZV3PatchContactAttributeKeyBody } from "../../lib/schemas";

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "contactAttributeKey",
  schemas: { params: ZV3ContactAttributeKeyIdParams, body: ZV3PatchContactAttributeKeyBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3ContactAttributeKey({
      attributeKeyId: parsedInput.params.attributeKeyId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "contactAttributeKey",
  schemas: { params: ZV3ContactAttributeKeyIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3ContactAttributeKey({
      attributeKeyId: parsedInput.params.attributeKeyId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
