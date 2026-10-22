import "server-only";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { type TChartResourceRow, getChartResourceRow } from "./service";

/** The signed-in user behind a session request; `null` for an API key, which has no user. */
export const getSessionUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication && authentication.user?.id ? authentication.user.id : null;

export type TV3ChartOperationContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Load a chart and authorize the caller against the workspace it lives in — never a workspace the caller
 * names, so a chart id cannot be paired with a workspace the caller happens to reach. A chart that does
 * not exist answers the same 403 as one the caller may not see.
 */
export async function loadAuthorizedChart(
  chartId: string,
  minPermission: TTeamPermission,
  { authentication, requestId, instance }: TV3ChartOperationContext
): Promise<Response | { row: TChartResourceRow; access: V3WorkspaceContext }> {
  const row = await getChartResourceRow(chartId);
  if (!row) {
    return problemForbidden(requestId, undefined, instance);
  }

  const access = await requireDashboardsAccess(
    authentication,
    row.workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  return { row, access };
}
