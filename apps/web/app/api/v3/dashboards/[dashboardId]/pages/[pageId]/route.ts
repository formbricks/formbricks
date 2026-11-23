/**
 * PATCH (rename, team limit) and DELETE (with its widgets; the charts stay)
 * /api/v3/dashboards/{dashboardId}/pages/{pageId}.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3DashboardPage, updateV3DashboardPage } from "../../../lib/page-operations";
import { ZV3DashboardPageParams, ZV3PageUpdateBody } from "../../../lib/schemas";

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "dashboardPage",
  schemas: { params: ZV3DashboardPageParams, query: ZV3EmptyQuery, body: ZV3PageUpdateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3DashboardPage({
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
  targetType: "dashboardPage",
  schemas: { params: ZV3DashboardPageParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3DashboardPage({ ...parsedInput.params, authentication, auditLog, requestId, instance }),
});
