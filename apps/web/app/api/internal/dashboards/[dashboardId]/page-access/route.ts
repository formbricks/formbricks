/**
 * GET /api/internal/dashboards/{dashboardId}/page-access — whether the signed-in person may limit this
 * dashboard's pages to teams, and the teams the Manage pages dialog shows (ENG-7481). Session-only.
 *
 * Internal surface: no OpenAPI entry and no stability promise. The limits themselves are part of the
 * public dashboard (`pages[].teamIds`) and are written through `PATCH /api/v3/dashboards/{id}/pages/{id}`
 * or the whole-dashboard `PUT`.
 */
import { getV3DashboardPageAccess } from "@/app/api/v3/dashboards/lib/page-operations";
import { ZV3DashboardIdParams } from "@/app/api/v3/dashboards/lib/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3DashboardPageAccess({
      dashboardId: parsedInput.params.dashboardId,
      authentication,
      requestId,
      instance,
    }),
});
