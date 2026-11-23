import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createApiKeyOperation, listApiKeysOperation } from "./lib/operations";
import { ZApiKeyCreateBody, ZApiKeysQuery } from "./schemas";

/** `GET /api/internal/api-keys?organizationId=`: the organization's API keys, for its settings page. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZApiKeysQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listApiKeysOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
    }),
});

/** `POST /api/internal/api-keys?organizationId=`: mint a key. The response carries the plaintext key, once. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZApiKeysQuery, body: ZApiKeyCreateBody },
  action: "created",
  targetType: "apiKey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createApiKeyOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
