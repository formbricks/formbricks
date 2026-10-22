/**
 * GET /api/v3/dashboards/{dashboardId} — the dashboard with every widget and its full chart.
 *
 * The workspace is resolved from the dashboard, never from the request: any query parameter is a 400.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3Dashboard } from "../lib/operations";
import { ZV3DashboardIdParams } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Dashboard({ dashboardId: parsedInput.params.dashboardId, authentication, requestId, instance }),
});
