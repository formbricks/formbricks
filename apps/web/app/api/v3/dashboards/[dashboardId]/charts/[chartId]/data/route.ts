/**
 * GET /api/v3/dashboards/{dashboardId}/charts/{chartId}/data — a widget's rows, read through its dashboard,
 * narrowed by the dashboard date range and the caller's filter picks.
 *
 * `rateLimit: false` because the operation charges the chart-query budget itself (600/min, shared with the
 * other chart query operations and the MCP tools), instead of the v3 default.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3DashboardChartData } from "../../../../lib/chart-data-operations";
import { ZV3DashboardChartDataQuery, ZV3DashboardChartParams } from "../../../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: { params: ZV3DashboardChartParams, query: ZV3DashboardChartDataQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3DashboardChartData({
      dashboardId: parsedInput.params.dashboardId,
      chartId: parsedInput.params.chartId,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});
