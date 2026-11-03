/**
 * GET /api/v3/dashboards/{dashboardId}/filters/{filterId}/values — the values a list dashboard filter
 * offers: what the dashboard's charts let through, narrowed by the date range and the other picks.
 *
 * `rateLimit: false` because the operation charges the chart-query budget itself, on a cache miss only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3DashboardFilterValues } from "../../../../lib/filter-values-operations";
import { ZV3DashboardFilterParams, ZV3DashboardFilterValuesQuery } from "../../../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: { params: ZV3DashboardFilterParams, query: ZV3DashboardFilterValuesQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3DashboardFilterValues({
      dashboardId: parsedInput.params.dashboardId,
      filterId: parsedInput.params.filterId,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});
