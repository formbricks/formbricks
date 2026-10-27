/**
 * /api/v3/creatives — list a workspace's creatives, and create one.
 *
 * Thin adapters: the orchestration lives in the operations, which the creative MCP tools call too. The
 * list takes raw `searchParams` because its `filter[...]` families and its cursor need the operation's
 * own parser (see `lib/list-query.ts`).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Creative, listV3Creatives } from "./lib/operations";
import { ZV3CreateCreativeBody } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) =>
    listV3Creatives({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "creative",
  schemas: { body: ZV3CreateCreativeBody, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Creative({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
