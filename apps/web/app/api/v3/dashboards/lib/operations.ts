import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  buildKeysetPage,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import { problemBadRequest, successListResponse, successResponse } from "@/app/api/v3/lib/response";
import { type TV3DashboardOperationContext, authorizeLoadedDashboard } from "./access";
import type { TV3DashboardListQuery } from "./schemas";
import { serializeV3Dashboard, serializeV3DashboardListItem } from "./serializers";
import { getDashboardResourceRow, listDashboardRows } from "./service";

const DASHBOARDS_CURSOR_KIND = "dashboards";
const DASHBOARDS_SORT = "-createdAt";

/**
 * `GET /api/v3/dashboards` → 200 `{ data, meta: { limit, nextCursor } }`, newest first, each with a
 * `widgetCount` instead of its widgets. `filter[chartId][eq]` lists the dashboards that hold a chart.
 */
export async function listV3Dashboards({
  query,
  authentication,
  requestId,
  instance,
}: TV3DashboardOperationContext & { query: TV3DashboardListQuery }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const filter = {
      workspaceId: access.workspaceId,
      nameContains: query["filter[name][contains]"],
      chartId: query["filter[chartId][eq]"],
    };
    const fp = computeFilterFingerprint(filter);

    let cursor: { value: string; id: string } | null = null;
    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: DASHBOARDS_CURSOR_KIND,
          sortBy: DASHBOARDS_SORT,
          fp,
        });
      } catch (error) {
        const reason = error instanceof InvalidInputError ? error.message : "The cursor is invalid.";
        return problemBadRequest(requestId, "Invalid query parameters", {
          instance,
          invalid_params: [{ name: "cursor", reason }],
        });
      }
    }

    const rows = await listDashboardRows({ filter, cursor, limit: query.limit });
    const { page, nextCursor } = buildKeysetPage({
      rows,
      limit: query.limit,
      kind: DASHBOARDS_CURSOR_KIND,
      sortBy: DASHBOARDS_SORT,
      fp,
      sortValue: (row) => row.createdAt,
    });

    return successListResponse(
      page.map(serializeV3DashboardListItem),
      { limit: query.limit, nextCursor },
      { requestId }
    );
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.list" });
  }
}

/**
 * `GET /api/v3/dashboards/{dashboardId}` → 200 `{ data }` with every widget and its full chart, so one
 * call tells a caller what is on the dashboard. Each widget then fetches its own data from the chart
 * data endpoint, so one slow chart never holds up the rest.
 */
export async function getV3Dashboard({
  dashboardId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string }): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardResourceRow(dashboardId),
      "read",
      context
    );
    if (loaded instanceof Response) return loaded;

    return successResponse(serializeV3Dashboard(loaded.row), { requestId: context.requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "dashboards.get",
    });
  }
}
