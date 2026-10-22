/**
 * GET /api/v3/charts — list a workspace's charts, newest first, with the dashboards each sits on.
 *
 * A thin adapter: the operations are shared with the MCP chart tools, which call them directly.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Charts } from "./lib/operations";
import { ZV3ChartListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3ChartListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Charts({ query: parsedInput.query, authentication, requestId, instance }),
});
