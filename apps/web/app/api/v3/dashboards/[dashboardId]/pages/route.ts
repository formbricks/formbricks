/**
 * POST /api/v3/dashboards/{dashboardId}/pages — add a page to a dashboard.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3DashboardPage } from "../../lib/page-operations";
import { ZV3DashboardIdParams, ZV3PageCreateBody } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "dashboardPage",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery, body: ZV3PageCreateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3DashboardPage({
      dashboardId: parsedInput.params.dashboardId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
