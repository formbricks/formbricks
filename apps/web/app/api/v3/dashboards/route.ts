/**
 * GET /api/v3/dashboards — list a workspace's dashboards, newest first, with widget counts.
 *
 * A thin adapter: the operations are shared with the MCP dashboard tools, which call them directly.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Dashboards } from "./lib/operations";
import { ZV3DashboardListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3DashboardListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Dashboards({ query: parsedInput.query, authentication, requestId, instance }),
});
