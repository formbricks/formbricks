/**
 * PATCH (move or repoint) and DELETE (take off the dashboard; the chart stays)
 * /api/v3/dashboards/{dashboardId}/widgets/{widgetId}.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { ZV3DashboardWidgetParams, ZV3WidgetUpdateBody } from "../../../lib/schemas";
import { removeV3DashboardWidget, updateV3DashboardWidget } from "../../../lib/widget-operations";

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "dashboardWidget",
  schemas: { params: ZV3DashboardWidgetParams, query: ZV3EmptyQuery, body: ZV3WidgetUpdateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3DashboardWidget({
      ...parsedInput.params,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "dashboardWidget",
  schemas: { params: ZV3DashboardWidgetParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    removeV3DashboardWidget({ ...parsedInput.params, authentication, auditLog, requestId, instance }),
});
