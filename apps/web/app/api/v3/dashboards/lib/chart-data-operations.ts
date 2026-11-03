import "server-only";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import {
  DATA_ROUTE_DATE_RANGE_NAMES,
  applyChartQueryRateLimit,
  emptyChartData,
  requestedDateRangeOf,
  runV3ChartQuery,
} from "@/app/api/v3/charts/lib/data-operations";
import type { TV3ChartData } from "@/app/api/v3/charts/lib/resources";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden, problemNotFound, successResponse } from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { resolvePicksForDataset } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import { parseStoredDashboardFilters } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import type { TV3DashboardChartData } from "./resources";
import type { TV3DashboardChartDataQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";

/**
 * Dashboard-bound reads: a chart's data, and a dashboard filter's value list, read through the dashboard
 * that shows them (ADR-0002). Both authorize the same way, in the two helpers below, so the one place that
 * decides who may read a dashboard and its datasets is here.
 */

/**
 * Read access to a dashboard's workspace, with the Dashboards entitlement. A dashboard that does not exist
 * answers the same 403 as one the caller may not see.
 */
export const authorizeDashboardRead = async (
  row: { workspaceId: string } | null,
  { authentication, requestId, instance }: TV3ChartOperationContext
): Promise<Response | V3WorkspaceContext> => {
  if (!row) return problemForbidden(requestId, undefined, instance);
  // ENG-6899: pass allowDashboardViewer
  return requireDashboardsAccess(authentication, row.workspaceId, "read", requestId, instance);
};

/** Read access to a Feedback Dataset a dashboard's chart reads; `null` when allowed. */
export const refuseUnlessDashboardDatasetReadable = (
  access: V3WorkspaceContext,
  datasetId: string,
  { authentication, requestId, instance }: TV3ChartOperationContext
): Promise<Response | null> =>
  // ENG-6899: pass allowDashboardViewer
  refuseUnlessFeedbackDatasetAccess(authentication, access, datasetId, "read", requestId, instance);

/** A chart that is not a widget on the dashboard: the same 404 whether it exists elsewhere or not at all. */
const chartNotOnDashboard = (chartId: string, { requestId, instance }: TV3ChartOperationContext): Response =>
  problemNotFound(requestId, "Chart", chartId, instance);

/**
 * `GET /api/v3/dashboards/{dashboardId}/charts/{chartId}/data` → 200 `{ data: { rows, optionLabels,
 * fieldLabels, query, unfilterableFilters } }`.
 *
 * A widget's data, read through the dashboard it sits on: what every dashboard widget and the MCP chart
 * data tool load. The dashboard date range narrows the chart's saved range, and each of the person's
 * filter picks is ANDed onto the chart's saved filters (ADR-0019) — a saved rule on the same field is kept.
 * A pick on a field the chart's Feedback Dataset lacks leaves the chart empty, naming the filter.
 *
 * Needs read access to the dashboard and to the chart's Feedback Dataset; spends from the chart-query budget.
 */
export async function getV3DashboardChartData({
  dashboardId,
  chartId,
  query,
  ...context
}: TV3ChartOperationContext & {
  dashboardId: string;
  chartId: string;
  query: TV3DashboardChartDataQuery;
}): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, dashboardId, chartId });

  try {
    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const row = await getDashboardChartsRow(dashboardId, { chartId });
    const access = await authorizeDashboardRead(row, context);
    if (access instanceof Response) return access;

    const chart = row?.widgets[0]?.chart;
    if (!chart) return chartNotOnDashboard(chartId, context);

    const refused = await refuseUnlessDashboardDatasetReadable(access, chart.feedbackDirectoryId, context);
    if (refused) return refused;

    const { rules, unfilterable } = resolvePicksForDataset(
      parseStoredDashboardFilters(row.filters),
      query.picks ?? {},
      await getDatasetFieldMatcher(chart.feedbackDirectoryId)
    );
    const unfilterableFilters = unfilterable.map(({ id, label }) => ({ id, label }));
    const respond = (data: TV3ChartData): TV3DashboardChartData => ({ ...data, unfilterableFilters });

    if (unfilterable.length > 0) {
      return successResponse(respond(emptyChartData(chart.query as TChartQuery)), {
        requestId: context.requestId,
      });
    }

    return await runV3ChartQuery({
      access,
      datasetId: chart.feedbackDirectoryId,
      type: resolveChartType(chart.type),
      query: chart.query,
      dateRange: requestedDateRangeOf(query),
      source: "v3.dashboards.chartData",
      dateRangeNames: DATA_ROUTE_DATE_RANGE_NAMES,
      extraFilters: rules,
      respond,
      context,
    });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "dashboards.chartData",
    });
  }
}
