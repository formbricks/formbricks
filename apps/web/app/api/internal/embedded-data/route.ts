import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createEmbeddedDataOperation, listEmbeddedDataOperation } from "./lib/operations";
import { ZEmbeddedDataCreateBody, ZEmbeddedDataListQuery } from "./schemas";

/** `GET /api/internal/embedded-data?workspaceId=`: the workspace's shared Embedded Data library. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZEmbeddedDataListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listEmbeddedDataOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});

/** `POST /api/internal/embedded-data?workspaceId=`: add a field to the library. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZEmbeddedDataListQuery, body: ZEmbeddedDataCreateBody },
  action: "created",
  targetType: "embeddedData",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createEmbeddedDataOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
