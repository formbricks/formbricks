import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  type TV3DashboardOperationContext,
  authorizeLoadedDashboard,
} from "@/app/api/v3/dashboards/lib/access";
import {
  getReadablePageIds,
  refuseUnlessDashboardOpenable,
} from "@/app/api/v3/dashboards/lib/dashboard-read-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { getViewerAccessReader } from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden, problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import { getViewerAccessRecordMatch } from "@/modules/ee/dashboard-access/lib/viewer-data-access";

/** Just what the check needs: the dashboard's workspace, its pages, and each chart widget's dataset. */
const getDashboardDatasetRow = (dashboardId: string) =>
  prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      id: true,
      workspaceId: true,
      pages: { select: { id: true } },
      widgets: { select: { pageId: true, chart: { select: { feedbackDirectoryId: true } } } },
    },
  });

/**
 * `GET /api/internal/dashboards/{dashboardId}/viewer-access` → 200 `{ data: { status } }`: whether the
 * reader's Dashboard Viewer access matches any record of the datasets on the pages they can open. The
 * dashboard read answers from conditions alone and never queries records, so a viewer whose values exist
 * but match nothing reads `restricted` there; the page asks this after it has drawn and shows "Your access
 * hasn't been set up" on `unmatched`. Authorized exactly like the dashboard read, `viewAs` included, and
 * not audited again: the read it follows already was.
 */
export async function getDashboardViewerAccessMatch({
  dashboardId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string }): Promise<Response> {
  const { requestId, instance, authentication } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardDatasetRow(dashboardId),
      "read",
      context,
      { allowDashboardViewer: true, viewAs: context.viewAs }
    );
    if (loaded instanceof Response) return loaded;
    const { row, access } = loaded;

    const refused = await refuseUnlessDashboardOpenable(access, row.id, context);
    if (refused) return refused;
    const readable = await getReadablePageIds(
      access,
      row.pages.map(({ id }) => id),
      authentication
    );
    if (readable.size === 0) return problemForbidden(requestId, undefined, instance);

    const reader = getViewerAccessReader(access);
    if (!reader) return successResponse({ status: "unrestricted" as const }, { requestId });
    const actor = getV3AuthorizationActor(authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    const datasetIds = [
      ...new Set(
        row.widgets.flatMap(({ pageId, chart }) =>
          chart && readable.has(pageId) ? [chart.feedbackDirectoryId] : []
        )
      ),
    ];
    const status = await getViewerAccessRecordMatch(reader, datasetIds, {
      workspaceId: access.workspaceId,
      actor,
    });
    return successResponse({ status }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.viewerAccess" });
  }
}
