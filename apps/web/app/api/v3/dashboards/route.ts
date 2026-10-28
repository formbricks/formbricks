/**
 * GET /api/v3/dashboards — list a workspace's dashboards, newest first, with widget counts.
 * POST /api/v3/dashboards — create a dashboard.
 *
 * A thin adapter: the operations are shared with the MCP dashboard tools, which call them directly.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Dashboard, listV3Dashboards } from "./lib/operations";
import { ZV3DashboardCreateBody, ZV3DashboardListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3DashboardListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Dashboards({ query: parsedInput.query, authentication, requestId, instance }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "dashboard",
  schemas: { body: ZV3DashboardCreateBody, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Dashboard({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
