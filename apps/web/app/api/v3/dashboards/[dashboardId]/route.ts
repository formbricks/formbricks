/**
 * GET, PATCH (rename) and DELETE /api/v3/dashboards/{dashboardId}.
 *
 * The workspace is resolved from the dashboard, never from the request: any query parameter is a 400.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Dashboard, getV3Dashboard, renameV3Dashboard } from "../lib/operations";
import { ZV3DashboardIdParams, ZV3DashboardRenameBody } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Dashboard({ dashboardId: parsedInput.params.dashboardId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "dashboard",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery, body: ZV3DashboardRenameBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    renameV3Dashboard({
      dashboardId: parsedInput.params.dashboardId,
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
  targetType: "dashboard",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Dashboard({
      dashboardId: parsedInput.params.dashboardId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
