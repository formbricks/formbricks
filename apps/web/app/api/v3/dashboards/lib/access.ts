import "server-only";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export type TV3DashboardOperationContext = TV3ChartOperationContext;

/**
 * Authorize the caller against the workspace a loaded dashboard lives in — taken from the row, never from
 * the request, so a dashboard id cannot be paired with a workspace the caller happens to reach. A
 * dashboard that does not exist answers the same 403 as one the caller may not see.
 */
export async function authorizeLoadedDashboard<TRow extends { workspaceId: string }>(
  row: TRow | null,
  minPermission: TTeamPermission,
  { authentication, requestId, instance }: TV3DashboardOperationContext
): Promise<Response | { row: TRow; access: V3WorkspaceContext }> {
  if (!row) return problemForbidden(requestId, undefined, instance);

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
