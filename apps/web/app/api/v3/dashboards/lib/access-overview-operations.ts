import "server-only";
import { logger } from "@formbricks/logger";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import {
  listDashboardAccessTeams,
  listViewAsMembers,
} from "@/modules/ee/dashboard-access/lib/dashboard-access-overview";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { type TV3DashboardOperationContext, authorizeLoadedDashboard } from "./access";
import { canManageDashboardAccess } from "./page-access";
import { getDashboardWorkspaceRow } from "./service";

/**
 * `GET /api/internal/dashboards/{dashboardId}/access` (ENG-7484): who opens the dashboard — the teams
 * with access to its workspace, without those limited to other dashboards — and the members an Owner or
 * Manager may View as. Only for whoever may manage the dashboard's access, on a plan with Access Control
 * and Dashboards; anyone else gets the same 403 as for a dashboard they cannot see.
 */
export async function getDashboardAccessOverview({
  dashboardId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardWorkspaceRow(dashboardId),
      "read",
      context
    );
    if (loaded instanceof Response) return loaded;
    const { workspaceId, organizationId } = loaded.access;

    const [canManage, entitled] = await Promise.all([
      canManageDashboardAccess(context.authentication, dashboardId, organizationId),
      getIsDashboardViewerRoleEnabled(organizationId),
    ]);
    if (!canManage || !entitled) return problemForbidden(requestId, undefined, instance);

    const [teams, members] = await Promise.all([
      listDashboardAccessTeams(dashboardId, workspaceId),
      listViewAsMembers(organizationId),
    ]);
    return successResponse({ organizationId, teams, members }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.access" });
  }
}
