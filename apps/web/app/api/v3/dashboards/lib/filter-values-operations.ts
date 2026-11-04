import "server-only";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import {
  DATA_ROUTE_DATE_RANGE_NAMES,
  applyChartQueryRateLimit,
  getOrganizationReportingTimeZone,
  requestedDateRangeOf,
  withChartQuerySlot,
} from "@/app/api/v3/charts/lib/data-operations";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadGateway,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { cache } from "@/lib/cache";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  findPickIssues,
  keepCurrentPicks,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import {
  isListDashboardFilter,
  parseStoredDashboardFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import {
  type TFilterValueQuery,
  buildBoundedChartQueries,
  buildFilterValueQueries,
  mergeFilterValues,
  resolveBoundedChartValues,
} from "@/modules/ee/analysis/dashboards/lib/filter-value-query";
import { parseRequestedDateRange } from "@/modules/ee/analysis/lib/chart-query-validator";
import { authorizeDashboardRead, refuseUnlessDashboardDatasetReadable } from "./chart-data-operations";
import type { TV3DashboardFilterValues } from "./resources";
import type { TV3DashboardFilterValuesQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";

/**
 * How long a value list is reused. Every viewer of a dashboard asks for the same lists as they pick, and
 * Cube's own cache does not spare the chart-query budget (ENG-6895); a minute keeps lists fresh enough.
 */
export const FILTER_VALUES_CACHE_TTL_MS = 60_000;

/**
 * Most Cube queries one value list may take (C8): one per Feedback Dataset for the charts merged into a
 * rule set, and up to two per chart bounded by its own groups (top-N or a measure rule, S6). A dashboard
 * needing more answers 422 rather than fanning out without bound on one request.
 */
export const MAX_FILTER_VALUE_QUERIES = 40;

/** How many of one list's Cube queries run at once. */
const FILTER_VALUE_QUERY_CONCURRENCY = 5;

const filterProblem = (
  name: string,
  reason: string,
  { requestId, instance }: TV3ChartOperationContext
): Response =>
  problemUnprocessableContent(requestId, "This filter has no value list", {
    instance,
    invalid_params: [{ name, reason, code: "invalid_reference" }],
  });

/**
 * The cache key for one list: the dashboard and the version it was read at (an editor's save moves it, so
 * a changed filter is never answered from before), each widget's chart and the version it was read at (a
 * chart edited in the chart builder does not move the dashboard, S7), the filter, the other filters'
 * picks, the date range and the search. Shared across everyone who may read the dashboard: they all see
 * the same list.
 */
const valuesCacheKey = (parts: {
  dashboardId: string;
  updatedAt: Date;
  charts: { id: string; updatedAt: Date }[];
  filterId: string;
  otherPicks: Record<string, string[]>;
  dateRange: unknown;
  search?: string;
}) => {
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        parts.updatedAt.toISOString(),
        parts.charts.map(({ id, updatedAt }) => [id, updatedAt.toISOString()]),
        parts.filterId,
        Object.entries(parts.otherPicks).sort(([a], [b]) => a.localeCompare(b)),
        parts.dateRange ?? null,
        parts.search ?? null,
      ])
    )
    .digest("hex");
  return createCacheKey.custom("analytics", parts.dashboardId, `filter-values:${digest}`);
};

/**
 * `GET /api/v3/dashboards/{dashboardId}/filters/{filterId}/values` → 200 `{ data: { values: [{ value }],
 * hasMore } }`.
 *
 * The values a list dashboard filter offers: those the dashboard's charts let through under their saved
 * filters and date ranges, narrowed by the dashboard date range and the other filters' picks — never by
 * this filter's own pick — and by a case-insensitive `search`. Up to 100, alphabetical, `hasMore` when more
 * match. A filter the dashboard does not have, or one that takes a typed value, answers 422.
 *
 * Needs read access to the dashboard and to each Feedback Dataset whose charts have the field. Answered
 * from a 60-second cache shared by every reader; only a cache miss spends from the chart-query budget.
 */
export async function listV3DashboardFilterValues({
  dashboardId,
  filterId,
  query,
  ...context
}: TV3ChartOperationContext & {
  dashboardId: string;
  filterId: string;
  query: TV3DashboardFilterValuesQuery;
}): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, filterId });

  try {
    const row = await getDashboardChartsRow(dashboardId);
    const access = await authorizeDashboardRead(row, context);
    if (access instanceof Response) return access;
    if (!row) return filterProblem("filterId", "Not a filter of this dashboard.", context);

    const filters = parseStoredDashboardFilters(row.filters);
    const filter = filters.find((candidate) => candidate.id === filterId);
    if (!filter) return filterProblem("filterId", "Not a filter of this dashboard.", context);
    if (!isListDashboardFilter(filter)) {
      return filterProblem(
        "filterId",
        "Only filters with 'equals' or 'notEquals' on a categorical field (one with a value lookup, or embedded data) pick from a list; this one takes a typed value.",
        context
      );
    }

    const pickIssues = findPickIssues(filters, query.picks ?? {});
    if (pickIssues.length > 0) {
      return problemUnprocessableContent(requestId, "The filter picks are not valid", {
        instance,
        invalid_params: pickIssues,
      });
    }

    const dateRange = requestedDateRangeOf(query);
    const requested = parseRequestedDateRange(dateRange, DATA_ROUTE_DATE_RANGE_NAMES);
    if (!requested.ok) {
      return problemUnprocessableContent(requestId, "The date range is not valid", {
        instance,
        invalid_params: requested.issues,
      });
    }

    const charts = row.widgets.map(({ chart }) => ({
      datasetId: chart.feedbackDirectoryId,
      // As the dashboard shows it: a big number is one group, whatever it was saved with.
      query: prepareQueryForChartType(chart.query as TChartQuery, resolveChartType(chart.type)),
    }));
    const datasetIds = [...new Set(charts.map((chart) => chart.datasetId))];
    const actor = getV3AuthorizationActor(context.authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    const filterFields = filters.map(({ field }) => field);
    const matchers = new Map(
      await Promise.all(
        datasetIds.map(
          async (datasetId) =>
            [
              datasetId,
              await getDatasetFieldMatcher(
                { datasetId, workspaceId: access.workspaceId, organizationId: access.organizationId, actor },
                filterFields
              ),
            ] as const
        )
      )
    );
    const datasetHasField = (datasetId: string, field: string) => matchers.get(datasetId)?.(field) ?? false;

    // Every dataset whose charts can offer values must be readable, so the one cached list is everyone's.
    // Checked together (C8): one dashboard can read many datasets.
    const refusals = await Promise.all(
      datasetIds
        .filter((id) => datasetHasField(id, filter.field))
        .map((datasetId) => refuseUnlessDashboardDatasetReadable(access, datasetId, context))
    );
    const refused = refusals.find((refusal) => refusal !== null);
    if (refused) return refused;

    const picks = keepCurrentPicks(filters, query.picks ?? {});
    const { [filter.id]: _ownPick, ...otherPicks } = picks;
    const cacheKey = valuesCacheKey({
      dashboardId,
      updatedAt: row.updatedAt,
      charts: row.widgets.map(({ chart }) => ({ id: chart.id, updatedAt: chart.updatedAt })),
      filterId,
      otherPicks,
      dateRange,
      search: query.search,
    });

    const cached = await cache.get<TV3DashboardFilterValues>(cacheKey);
    if (cached.ok && cached.data) return successResponse(cached.data, { requestId });

    const plan = {
      filter,
      filters,
      charts,
      picks: otherPicks,
      dateFilter: requested.filter,
      clock: { timeZone: await getOrganizationReportingTimeZone(access.organizationId) },
      datasetHasField,
    };
    const queries = buildFilterValueQueries({ ...plan, search: query.search });
    const groups = buildBoundedChartQueries(plan);
    if (queries.length + 2 * groups.length > MAX_FILTER_VALUE_QUERIES) {
      return problemUnprocessableContent(requestId, "This filter's value list needs too many queries", {
        instance,
        invalid_params: [
          {
            name: "filterId",
            reason: `The dashboard's charts need more than ${MAX_FILTER_VALUE_QUERIES} queries (MAX_FILTER_VALUE_QUERIES) to list this filter's values. Type a value instead, or split the dashboard.`,
            code: "limit_exceeded",
          },
        ],
      });
    }

    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const run = async ({ datasetId, query: cubeQuery }: TFilterValueQuery): Promise<unknown[]> => {
      const rows = await executeTenantScopedQuery({
        query: cubeQuery,
        feedbackDirectoryId: datasetId,
        workspaceId: access.workspaceId,
        organizationId: access.organizationId,
        actor,
        source: "v3.dashboards.filterValues",
      });
      return Array.isArray(rows) ? (rows as unknown[]) : [];
    };

    return await withChartQuerySlot(context, async () => {
      // First the merged value queries and the bounded charts' own queries; then, for each bounded chart
      // not grouped by the field, its values within the groups it showed (S6).
      const [results, groupRows] = await Promise.all([
        mapWithConcurrency(queries, FILTER_VALUE_QUERY_CONCURRENCY, run),
        mapWithConcurrency(groups, FILTER_VALUE_QUERY_CONCURRENCY, run),
      ]);
      const resolved = groups.map((group, index) =>
        resolveBoundedChartValues({ filter, group, rows: groupRows[index], search: query.search })
      );
      const secondStep = resolved.flatMap((outcome) => (outcome.type === "query" ? [outcome.query] : []));
      const groupValues = resolved.flatMap((outcome) =>
        outcome.type === "values" ? [outcome.values.map((value) => ({ [filter.field]: value }))] : []
      );
      const secondResults = await mapWithConcurrency(secondStep, FILTER_VALUE_QUERY_CONCURRENCY, run);

      const data: TV3DashboardFilterValues = mergeFilterValues(filter.field, [
        ...results,
        ...groupValues,
        ...secondResults,
      ]);
      const stored = await cache.set(cacheKey, data, FILTER_VALUES_CACHE_TTL_MS);
      if (!stored.ok) log.warn({ error: stored.error }, "Could not cache a dashboard filter's values");
      return successResponse(data, { requestId });
    });
  } catch (error) {
    if (error instanceof CubeQueryError) {
      return problemBadGateway(
        requestId,
        error.timedOut
          ? "The value lookup took too long and was stopped."
          : "The values could not be looked up. Try again shortly.",
        instance
      );
    }
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.filterValues" });
  }
}
