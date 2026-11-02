/**
 * GET /api/v3/charts/{chartId}/data — a saved chart's rows, optionally for a requested date range.
 *
 * `rateLimit: false` because the operation charges the chart-query budget itself (600/min, shared with
 * preview and field values, and with the MCP tools), instead of the v3 default.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3ChartData } from "../../lib/data-operations";
import { ZV3ChartDataQuery, ZV3ChartIdParams } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: { params: ZV3ChartIdParams, query: ZV3ChartDataQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3ChartData({
      chartId: parsedInput.params.chartId,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});
