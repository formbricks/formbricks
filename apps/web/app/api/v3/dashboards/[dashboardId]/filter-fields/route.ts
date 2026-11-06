/**
 * GET /api/v3/dashboards/{dashboardId}/filter-fields — the embedded-data fields a filter on the dashboard
 * can use: the keys of the Feedback Datasets its charts read. A dashboard-bound read, so a Dashboard viewer
 * may make it (ADR-0025). Spends from the default v3 budget, like the dashboard read.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { listV3DashboardFilterFields } from "../../lib/filter-fields-operations";
import { ZV3DashboardIdParams } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3DashboardFilterFields({
      dashboardId: parsedInput.params.dashboardId,
      authentication,
      requestId,
      instance,
    }),
});
