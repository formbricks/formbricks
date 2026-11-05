/**
 * /api/v3/creatives/{creativeId} — read, change and delete one creative. The workspace is resolved from
 * the creative; an unknown or inaccessible id answers 403, not 404.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Creative, getV3Creative, patchV3Creative } from "../lib/operations";
import { ZV3CreativeIdParams, ZV3PatchCreativeBody } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    getV3Creative({ creativeId: parsedInput.params.creativeId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "creative",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery, body: ZV3PatchCreativeBody },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    patchV3Creative({
      creativeId: parsedInput.params.creativeId,
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
  targetType: "creative",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    deleteV3Creative({
      creativeId: parsedInput.params.creativeId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
