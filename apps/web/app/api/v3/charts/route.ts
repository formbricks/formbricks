/**
 * GET /api/v3/charts — list a workspace's charts, newest first, with the dashboards each sits on.
 * POST /api/v3/charts — create a chart on a Feedback Dataset.
 *
 * A thin adapter: the operations are shared with the MCP chart tools, which call them directly.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Chart, listV3Charts } from "./lib/operations";
import { ZV3ChartCreateBody, ZV3ChartListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3ChartListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Charts({ query: parsedInput.query, authentication, requestId, instance }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "chart",
  schemas: { body: ZV3ChartCreateBody, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Chart({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
