/**
 * POST /api/v3/dashboards/{dashboardId}/widgets — put a chart on a dashboard.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { ZV3DashboardIdParams, ZV3WidgetCreateBody } from "../../lib/schemas";
import { addV3DashboardWidget } from "../../lib/widget-operations";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "dashboardWidget",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery, body: ZV3WidgetCreateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    addV3DashboardWidget({
      dashboardId: parsedInput.params.dashboardId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
