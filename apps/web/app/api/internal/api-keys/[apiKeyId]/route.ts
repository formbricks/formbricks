import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteApiKeyOperation, updateApiKeyOperation } from "../lib/operations";
import { ZApiKeyIdParams, ZApiKeyUpdateBody } from "../schemas";

/** `PATCH /api/internal/api-keys/{apiKeyId}`: rename a key. Its permissions are fixed at creation. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZApiKeyIdParams, body: ZApiKeyUpdateBody },
  action: "updated",
  targetType: "apiKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateApiKeyOperation({
      authentication,
      apiKeyId: parsedInput.params.apiKeyId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/api-keys/{apiKeyId}`: revoke a key. Requests using it fail from then on. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZApiKeyIdParams },
  action: "deleted",
  targetType: "apiKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteApiKeyOperation({
      authentication,
      apiKeyId: parsedInput.params.apiKeyId,
      requestId,
      instance,
      auditLog,
    }),
});
