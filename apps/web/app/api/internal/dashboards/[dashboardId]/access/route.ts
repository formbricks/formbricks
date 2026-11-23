/**
 * GET /api/internal/dashboards/{dashboardId}/access — the dashboard's Access dialog and View as picker
 * (ENG-7484): the teams that open it and the organization's members, for Owners and Managers. Session-only.
 *
 * Internal surface: no OpenAPI entry and no stability promise. Team dashboard limits are public through
 * `/api/v3/teams/{teamId}/dashboard-limits`.
 */
import { getDashboardAccessOverview } from "@/app/api/v3/dashboards/lib/access-overview-operations";
import { ZV3DashboardIdParams } from "@/app/api/v3/dashboards/lib/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZV3DashboardIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getDashboardAccessOverview({
      dashboardId: parsedInput.params.dashboardId,
      authentication,
      requestId,
      instance,
    }),
});
