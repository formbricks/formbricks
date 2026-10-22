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
import {
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import type { TV3ChartListQuery } from "./schemas";
import { serializeV3Chart } from "./serializers";
import { type TChartResourceRow, getChartResourceRow, listChartResourceRows } from "./service";

export type TV3ChartOperationContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const CHARTS_CURSOR_KIND = "charts";
const CHARTS_SORT = "-createdAt";

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

/**
 * `GET /api/v3/charts` → 200 `{ data, meta: { limit, nextCursor } }`, newest first.
 *
 * The cursor carries no authority: the workspace is authorized before the cursor is even decoded, and
 * the cursor is bound to the filter set, so changing a filter mid-walk is a 400 rather than a page from
 * a different listing.
 */
export async function listV3Charts({
  query,
  authentication,
  requestId,
  instance,
}: TV3ChartOperationContext & { query: TV3ChartListQuery }): Promise<Response> {
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
      datasetId: query["filter[datasetId][eq]"],
    };
    const fp = computeFilterFingerprint(filter);

    let cursor: { value: string; id: string } | null = null;
    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, { kind: CHARTS_CURSOR_KIND, sortBy: CHARTS_SORT, fp });
      } catch (error) {
        const reason = error instanceof InvalidInputError ? error.message : "The cursor is invalid.";
        return problemBadRequest(requestId, "Invalid query parameters", {
          instance,
          invalid_params: [{ name: "cursor", reason }],
        });
      }
    }

    const rows = await listChartResourceRows({ filter, cursor, limit: query.limit });
    const { page, nextCursor } = buildKeysetPage({
      rows,
      limit: query.limit,
      kind: CHARTS_CURSOR_KIND,
      sortBy: CHARTS_SORT,
      fp,
      sortValue: (row) => row.createdAt,
    });

    return successListResponse(page.map(serializeV3Chart), { limit: query.limit, nextCursor }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.list" });
  }
}

/** `GET /api/v3/charts/{chartId}` → 200 `{ data }`, with the dashboards that hold the chart embedded. */
export async function getV3Chart({
  chartId,
  ...context
}: TV3ChartOperationContext & { chartId: string }): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, chartId });

  try {
    const loaded = await loadAuthorizedChart(chartId, "read", context);
    if (loaded instanceof Response) return loaded;

    return successResponse(serializeV3Chart(loaded.row), { requestId: context.requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "charts.get",
    });
  }
}
