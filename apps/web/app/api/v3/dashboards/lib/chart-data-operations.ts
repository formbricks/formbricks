import "server-only";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import {
  DATA_ROUTE_DATE_RANGE_NAMES,
  applyChartQueryRateLimit,
  emptyChartData,
  getOrganizationReportingTimeZone,
  requestedDateRangeOf,
  runV3ChartQuery,
} from "@/app/api/v3/charts/lib/data-operations";
import type { TV3ChartData } from "@/app/api/v3/charts/lib/resources";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  type TDashboardsAccessContext,
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { getV3RateLimitPrincipal } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemForbidden,
  problemNotFound,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  findPickIssues,
  resolvePicksForDataset,
  withLockedFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import { resolveFilterRules } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { withCachedDashboardDecision } from "./read-decision-cache";
import type { TV3DashboardChartData } from "./resources";
import type { TV3DashboardChartDataQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";
import { refuseUnreadableLockedFilters } from "./unreadable-locked-filters";
import { refuseUngroupedFieldsForViewer } from "./viewer-filter-fields";

/**
 * Dashboard-bound reads: a chart's data, and a dashboard filter's value list, read through the dashboard
 * that shows them (ADR-0002). Both authorize the same way, in the two helpers below, so the one place that
 * decides who may read a dashboard and its datasets is here.
 */

/** The dashboard a read goes through, at the version it was read: what its read decisions are kept for. */
type TReadDashboard = { id: string; workspaceId: string; updatedAt: Date };

/**
 * Read access to a dashboard's workspace, with the Dashboards entitlement. A dashboard-bound read, so a
 * Dashboard viewer of the workspace is admitted too (ADR-0025). A dashboard that does not exist answers
 * the same 403 as one the caller may not see. An allowed decision is reused for 30 seconds for the same
 * caller and dashboard version (`withCachedDashboardDecision`): every widget and value list asks it.
 */
export const authorizeDashboardRead = async (
  row: TReadDashboard | null,
  { authentication, requestId, instance }: TV3ChartOperationContext
): Promise<Response | TDashboardsAccessContext> => {
  if (!row) return problemForbidden(requestId, undefined, instance);
  return withCachedDashboardDecision(
    { dashboard: row, principal: getV3RateLimitPrincipal(authentication), decision: "dashboard" },
    () =>
      requireDashboardsAccess(authentication, row.workspaceId, "read", requestId, instance, {
        allowDashboardViewer: true,
      })
  );
};

/**
 * Read access to a Feedback Dataset a dashboard's chart reads, as a dashboard-bound read: `read`, or
 * `feedbackDirectoryAssignment.dashboard_read` for a caller `authorizeDashboardRead` admitted as the
 * workspace's Dashboard viewer; `null` when allowed. Reused like the dashboard's own decision.
 */
export const refuseUnlessDashboardDatasetReadable = async (
  access: TDashboardsAccessContext,
  datasetId: string,
  dashboard: TReadDashboard,
  { authentication, requestId, instance }: TV3ChartOperationContext
): Promise<Response | null> => {
  const decided = await withCachedDashboardDecision(
    {
      dashboard,
      principal: getV3RateLimitPrincipal(authentication),
      decision: `dataset:${datasetId}:${access.asDashboardViewer ? "viewer" : "member"}`,
    },
    async () =>
      (await refuseUnlessFeedbackDatasetAccess(
        authentication,
        access,
        datasetId,
        "read",
        requestId,
        instance,
        { allowDashboardViewer: true }
      )) ?? { allowed: true as const }
  );
  return decided instanceof Response ? decided : null;
};

/** A chart that is not a widget on the dashboard: the same 404 whether it exists elsewhere or not at all. */
const chartNotOnDashboard = (chartId: string, { requestId, instance }: TV3ChartOperationContext): Response =>
  problemNotFound(requestId, "Chart", chartId, instance);

/**
 * `GET /api/v3/dashboards/{dashboardId}/charts/{chartId}/data` → 200 `{ data: { rows, optionLabels,
 * fieldLabels, memberLabels, query, unfilterableFilters } }`.
 *
 * A widget's data, read through the dashboard it sits on: what every dashboard widget and the MCP chart
 * data tool load. The dashboard date range replaces the chart's saved range, and each of the person's
 * filters (`filter[<id>]`, with its values in `picks[<id>]`) is ANDed onto the chart's saved filters
 * (ADR-0026) — a saved rule on the same field is kept — and so is every filter an editor locked on the
 * dashboard, whoever reads it. A filter on a field the chart's Feedback Dataset
 * lacks leaves the chart empty, naming the filter.
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

    const refused = await refuseUnlessDashboardDatasetReadable(
      access,
      chart.feedbackDirectoryId,
      row,
      context
    );
    if (refused) return refused;

    const actor = getV3AuthorizationActor(context.authentication);
    if (!actor) return problemUnauthorized(context.requestId, "Not authenticated", context.instance);

    // The caller's own filters, named by the request. The dashboard's locked ones are added after these
    // are checked: they were checked when an editor saved them.
    const { filters: requestFilters, issues: filterIssues } = resolveFilterRules(query.rules);
    if (filterIssues.length > 0) {
      return problemUnprocessableContent(context.requestId, "The filters are not valid", {
        instance: context.instance,
        invalid_params: filterIssues,
      });
    }
    // A viewer's own filters may name only the embedded data the dashboard's charts group by. This read
    // carries one chart, so the dashboard's others are read for it, and only when an embedded key is named.
    if (access.asDashboardViewer && requestFilters.some(({ field }) => isEmbeddedMemberName(field))) {
      const ungrouped = refuseUngroupedFieldsForViewer(
        access,
        requestFilters.map(({ field }) => field),
        (await getDashboardChartsRow(dashboardId))?.widgets ?? [],
        context
      );
      if (ungrouped) return ungrouped;
    }
    // Picks are checked before any query: a value its field cannot hold, or more than the total budget,
    // is the caller's to fix (422), not a Cube failure (C6, C9).
    const pickIssues = findPickIssues(requestFilters, query.picks ?? {});
    if (pickIssues.length > 0) {
      return problemUnprocessableContent(context.requestId, "The filter picks are not valid", {
        instance: context.instance,
        invalid_params: pickIssues,
      });
    }
    const { filters: dashboardFilters, picks } = withLockedFilters(
      row.filters,
      requestFilters,
      query.picks ?? {}
    );
    const { rules, unfilterable } = resolvePicksForDataset(
      dashboardFilters,
      picks,
      await getDatasetFieldMatcher(
        {
          datasetId: chart.feedbackDirectoryId,
          workspaceId: access.workspaceId,
          organizationId: access.organizationId,
          actor,
        },
        dashboardFilters.map(({ field }) => field)
      ),
      // A picked day is a whole day where the organization reports, as its charts' date ranges are.
      { timeZone: await getOrganizationReportingTimeZone(access.organizationId) }
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
    const { requestId, instance } = context;
    return (
      refuseUnreadableLockedFilters(error, { dashboardId, log, requestId, instance }) ??
      mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.chartData" })
    );
  }
}
