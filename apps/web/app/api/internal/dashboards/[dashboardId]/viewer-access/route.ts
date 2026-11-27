/**
 * GET /api/internal/dashboards/{dashboardId}/viewer-access — whether a Dashboard Viewer's access matches
 * any record on the dashboard, asked by the dashboard page after it has drawn. Session-only; takes the
 * dashboard read's `viewAs`.
 *
 * Internal surface: no OpenAPI entry and no stability promise. The access summary itself is public as
 * `viewerAccess` on `GET /api/v3/dashboards/{dashboardId}`.
 */
import { ZV3DashboardIdParams, ZV3DashboardReadQuery } from "@/app/api/v3/dashboards/lib/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getDashboardViewerAccessMatch } from "../../lib/viewer-access-operations";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZV3DashboardIdParams, query: ZV3DashboardReadQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getDashboardViewerAccessMatch({
      dashboardId: parsedInput.params.dashboardId,
      viewAs: parsedInput.query.viewAs,
      authentication,
      requestId,
      instance,
    }),
});
