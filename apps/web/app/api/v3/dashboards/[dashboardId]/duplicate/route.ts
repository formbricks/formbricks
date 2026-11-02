/**
 * POST /api/v3/dashboards/{dashboardId}/duplicate — copy a dashboard; the copy shares the original's charts.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { duplicateV3Dashboard } from "../../lib/operations";
import { ZV3DashboardDuplicateBody, ZV3DashboardIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "dashboard",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery, body: ZV3DashboardDuplicateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    duplicateV3Dashboard({
      dashboardId: parsedInput.params.dashboardId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
