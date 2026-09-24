/**
 * GET /api/v3/responses — list responses for a workspace, newest first.
 *
 * Raw `searchParams` rather than a wrapper-parsed schema, matching the surveys list: the query
 * carries bracket-style `filter[...]` families that a flat Zod object cannot describe, and the
 * cursor's 400 has to name `cursor` specifically rather than fail as a generic parse error.
 *
 * A thin adapter on purpose: the orchestration lives in the operation and the service, which the MCP
 * server also calls directly with no wrapper around them.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Response, listV3Responses } from "./lib/operations";
import { ZV3CreateResponseBody } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) =>
    listV3Responses({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    }),
});

/**
 * POST /api/v3/responses — record a real submission.
 *
 * The workspace is resolved from the body's `surveyId`, never supplied, so the caller cannot choose
 * the scope it is authorized against. An empty strict query means any query parameter is a 400.
 */
export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "response",
  schemas: { body: ZV3CreateResponseBody, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Response({
      authentication,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});
