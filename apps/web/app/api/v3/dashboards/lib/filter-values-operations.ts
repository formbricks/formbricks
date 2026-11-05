import "server-only";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import type { CacheKey as TCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import {
  DATA_ROUTE_DATE_RANGE_NAMES,
  getOrganizationReportingTimeZone,
  holdChartQuerySlot,
  requestedDateRangeOf,
} from "@/app/api/v3/charts/lib/data-operations";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  applyV3OperationRateLimit,
  getV3RateLimitPrincipal,
  reserveV3OperationRateLimit,
} from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadGateway,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { cache } from "@/lib/cache";
import { loggableError } from "@/lib/utils/loggable-error";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { resolveChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  findPickIssues,
  keepCurrentPicks,
  withLockedFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import { resolveFilterRules } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import {
  type TDashboardFilter,
  isListDashboardFilter,
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
import { createRequestEmbeddedKeys } from "@/modules/ee/analysis/lib/request-embedded-keys";
import { authorizeDashboardRead, refuseUnlessDashboardDatasetReadable } from "./chart-data-operations";
import type { TV3DashboardFilterValues } from "./resources";
import type { TV3DashboardFilterValuesQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";
import { refuseUnreadableLockedFilters } from "./unreadable-locked-filters";
import { refuseUngroupedFieldsForViewer } from "./viewer-filter-fields";

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

/** How many of one list's Cube queries run at once, its merged and its bounded charts' queries together. */
const FILTER_VALUE_QUERY_CONCURRENCY = 5;

/** How long one instance holds the right to build a list others wait for: longer than a Cube query may run. */
const FILTER_VALUES_LOCK_MS = 70_000;

/** How long a request waits for another instance's list before building it itself, and how often it looks. */
const FILTER_VALUES_WAIT_MS = 2_000;
const FILTER_VALUES_POLL_MS = 100;

/** Lists being built in this process, so requests for the same list at once ask Cube once. */
const inFlight = new Map<string, Promise<TBuiltList>>();

type TBuiltList = { data: TV3DashboardFilterValues } | { refused: Response };

/** A Cube query of a list found every in-flight chart query slot taken: the build stops, answering 429. */
class FilterValuesSlotRefused extends Error {
  constructor(readonly refused: Response) {
    super("Every in-flight chart query slot is taken");
  }
}

const runOnce = (key: string, build: () => Promise<TBuiltList>): Promise<TBuiltList> => {
  const running = inFlight.get(key);
  if (running) return running;
  const started = build().finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The list another instance is building, once it lands in the cache within `FILTER_VALUES_WAIT_MS`. */
const waitForCachedList = async (cacheKey: TCacheKey): Promise<TV3DashboardFilterValues | null> => {
  for (let waited = 0; waited < FILTER_VALUES_WAIT_MS; waited += FILTER_VALUES_POLL_MS) {
    await pause(FILTER_VALUES_POLL_MS);
    const cached = await cache.get<TV3DashboardFilterValues>(cacheKey);
    if (cached.ok && cached.data) return cached.data;
  }
  return null;
};

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
 * chart edited in the chart builder does not move the dashboard, S7), every filter's definition — the
 * request names its own filters, so an id like `f1` says nothing about the field on its own — the other
 * filters' picks, the date range and the search. Shared across everyone who may read the dashboard: they all see
 * the same list.
 */
const valuesCacheKey = (parts: {
  dashboardId: string;
  updatedAt: Date;
  charts: { id: string; updatedAt: Date }[];
  filterId: string;
  filters: readonly Pick<TDashboardFilter, "id" | "field" | "operator">[];
  otherPicks: Record<string, string[]>;
  dateRange: unknown;
  search?: string;
}): { cacheKey: TCacheKey; lockKey: TCacheKey } => {
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        parts.updatedAt.toISOString(),
        parts.charts.map(({ id, updatedAt }) => [id, updatedAt.toISOString()]),
        parts.filterId,
        parts.filters.map(({ id, field, operator }) => [id, field, operator]),
        Object.entries(parts.otherPicks).sort(([a], [b]) => a.localeCompare(b)),
        parts.dateRange ?? null,
        parts.search ?? null,
      ])
    )
    .digest("hex");
  return {
    cacheKey: createCacheKey.custom("analytics", parts.dashboardId, `filter-values:${digest}`),
    lockKey: createCacheKey.custom("analytics", parts.dashboardId, `filter-values-lock:${digest}`),
  };
};

/**
 * The read a value-list request asks for, authorized: the dashboard, the caller, the list filter, the
 * filters that apply (locked ones first), the charts as the dashboard shows them, and which datasets
 * have which fields. Any refusal comes back as the response to send.
 */
const resolveValueListRequest = async ({
  dashboardId,
  filterId,
  query,
  context,
}: {
  dashboardId: string;
  filterId: string;
  query: TV3DashboardFilterValuesQuery;
  context: TV3ChartOperationContext;
}) => {
  const { requestId, instance } = context;
  const row = await getDashboardChartsRow(dashboardId);
  const access = await authorizeDashboardRead(row, context);
  if (access instanceof Response) return access;
  if (!row) return filterProblem("filterId", "Not a filter of this dashboard.", context);

  const checked = checkValuesRequest(query, filterId, context);
  if (checked instanceof Response) return checked;
  const { filters, filter, dateRange, requested } = checked;
  const ungrouped = refuseUngroupedFieldsForViewer(
    access,
    [filter.field, ...filters.map(({ field }) => field)],
    row.widgets,
    context
  );
  if (ungrouped) return ungrouped;

  const charts = row.widgets.map(({ chart }) => ({
    datasetId: chart.feedbackDirectoryId,
    // As the dashboard shows it: a big number is one group, whatever it was saved with.
    query: prepareQueryForChartType(chart.query as TChartQuery, resolveChartType(chart.type)),
  }));
  const datasetIds = [...new Set(charts.map((chart) => chart.datasetId))];
  const actor = getV3AuthorizationActor(context.authentication);
  if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

  // Every dataset whose charts can offer values must be readable, so the one cached list is everyone's.
  // Checked together (C8): one dashboard can read many datasets. Checked before any dataset's embedded
  // keys are read, as the filter-fields read does: which keys a dataset has is not asked for a caller who
  // may not read it — so every widget's dataset counts, whether or not it turns out to have the field.
  const refused = await refuseUnlessAllReadable(datasetIds, (datasetId) =>
    refuseUnlessDashboardDatasetReadable(access, datasetId, row, context)
  );
  if (refused) return refused;

  // The values offered are those left once the dashboard's locked filters apply, as on its charts.
  const locked = withLockedFilters(row.filters, filters, requestPicks(query));
  const filterFields = locked.filters.map(({ field }) => field);
  const datasetHasField = await matchDatasetFields(datasetIds, filterFields, (datasetId) => ({
    datasetId,
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actor,
  }));

  return { row, access, actor, filter, locked, charts, datasetHasField, dateRange, requested };
};

/** The key one principal's concurrent requests for a list share a build under. */
const principalBuildKey = (cacheKey: TCacheKey, context: TV3ChartOperationContext): string =>
  `${String(cacheKey)}:${getV3RateLimitPrincipal(context.authentication) ?? "anonymous"}`;

/** The request's picks, or none. */
const requestPicks = (query: TV3DashboardFilterValuesQuery): Record<string, string[]> => query.picks ?? {};

/**
 * Build a list while holding its cross-instance lock. When another instance holds it, that instance's
 * cached result is waited for briefly instead, and built here only if it does not come.
 */
const buildUnderListLock = async (
  keys: { cacheKey: TCacheKey; lockKey: TCacheKey },
  build: () => Promise<TBuiltList>
): Promise<TBuiltList> => {
  const locked = await cache.tryLock(keys.lockKey, "1", FILTER_VALUES_LOCK_MS);
  if (locked.ok && !locked.data) {
    const waited = await waitForCachedList(keys.cacheKey);
    if (waited) return { data: waited };
  }
  try {
    return await build();
  } finally {
    if (locked.ok && locked.data) await cache.del([keys.lockKey]);
  }
};

/**
 * Runs value-list queries one in-flight slot each, not the whole build in one: a slot's lease is sized to
 * one query, and a list may run up to MAX_FILTER_VALUE_QUERIES of them. A refused slot stops the build.
 * `ran` counts the queries that ran, which is what the reserved budget is settled with.
 */
const createSlottedRunner = (
  context: TV3ChartOperationContext,
  run: (query: TFilterValueQuery) => Promise<unknown[]>
) => {
  let ran = 0;
  return {
    run: async (query: TFilterValueQuery): Promise<unknown[]> => {
      const held = await holdChartQuerySlot(context, () => {
        ran += 1;
        return run(query);
      });
      if ("refused" in held) throw new FilterValuesSlotRefused(held.refused);
      return held.value;
    },
    ran: () => ran,
  };
};

/**
 * Runs one value-list Cube query in the caller's tenant. One list runs many queries on few datasets, so
 * their tokens' embedded keys are resolved once per dataset.
 */
const createValueQueryRunner = (scope: {
  workspaceId: string;
  organizationId: string;
  actor: NonNullable<ReturnType<typeof getV3AuthorizationActor>>;
}) => {
  const embeddedKeysFor = createRequestEmbeddedKeys((datasetId) => ({ datasetId, ...scope }));
  return async ({ datasetId, query: cubeQuery }: TFilterValueQuery): Promise<unknown[]> => {
    const rows = await executeTenantScopedQuery({
      query: cubeQuery,
      feedbackDirectoryId: datasetId,
      ...scope,
      source: "v3.dashboards.filterValues",
      embeddedKeys: await embeddedKeysFor(datasetId, cubeQuery),
    });
    return Array.isArray(rows) ? (rows as unknown[]) : [];
  };
};

/** Of the bounded charts' outcomes, the queries still to run and the values already known, as rows. */
const splitBoundedOutcomes = (
  outcomes: ReturnType<typeof resolveBoundedChartValues>[],
  field: string
): { secondStep: TFilterValueQuery[]; groupValues: Record<string, string>[][] } => ({
  secondStep: outcomes.flatMap((outcome) => (outcome.type === "query" ? [outcome.query] : [])),
  groupValues: outcomes.flatMap((outcome) =>
    outcome.type === "values" ? [outcome.values.map((value) => ({ [field]: value }))] : []
  ),
});

/** The first refusal among the datasets, all asked at once, or `null` when every one is readable. */
const refuseUnlessAllReadable = async (
  datasetIds: readonly string[],
  refuse: (datasetId: string) => Promise<Response | null>
): Promise<Response | null> =>
  (await Promise.all(datasetIds.map(refuse))).find((refusal) => refusal !== null) ?? null;

/** Which of `fields` each dataset has, read once per dataset, as one `(datasetId, field)` check. */
const matchDatasetFields = async (
  datasetIds: readonly string[],
  fields: readonly string[],
  scopeOf: (datasetId: string) => Parameters<typeof getDatasetFieldMatcher>[0]
): Promise<(datasetId: string, field: string) => boolean> => {
  const matchers = new Map(
    await Promise.all(
      datasetIds.map(
        async (datasetId) => [datasetId, await getDatasetFieldMatcher(scopeOf(datasetId), fields)] as const
      )
    )
  );
  return (datasetId, field) => matchers.get(datasetId)?.(field) ?? false;
};

/**
 * What a value-list request names, checked before anything is read: its filters, the one whose values are
 * asked for (a list filter of the request), its picks and its date range. A problem is the caller's to fix,
 * a 422 naming it.
 */
const checkValuesRequest = (
  query: TV3DashboardFilterValuesQuery,
  filterId: string,
  context: TV3ChartOperationContext
) => {
  const { requestId, instance } = context;
  const { filters, issues: filterIssues } = resolveFilterRules(query.rules);
  if (filterIssues.length > 0) {
    return problemUnprocessableContent(requestId, "The filters are not valid", {
      instance,
      invalid_params: filterIssues,
    });
  }
  const filter = filters.find((candidate) => candidate.id === filterId);
  if (!filter) return filterProblem("filterId", "Not one of the request's filter[<id>] parameters.", context);
  if (!isListDashboardFilter(filter)) {
    return filterProblem(
      "filterId",
      "Only filters with 'equals' or 'notEquals' on a categorical field (one with a value lookup, embedded data, or a yes/no field) pick from a list; this one takes a typed value.",
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

  return { filters, filter, dateRange, requested };
};

/**
 * `GET /api/v3/dashboards/{dashboardId}/filters/{filterId}/values` → 200 `{ data: { values: [{ value }],
 * hasMore } }`.
 *
 * The values a list filter offers: those the dashboard's charts let through under their saved filters,
 * narrowed by the dashboard date range and the other filters' picks — never by this filter's own pick — and
 * by a case-insensitive `search`. Up to 100, alphabetical, `hasMore` when more match. `filterId` is one of
 * the request's `filter[<id>]` parameters; one that is not, or one that takes a typed value, answers 422.
 *
 * Needs read access to the dashboard and to each Feedback Dataset its charts read. Every
 * request spends from the default v3 budget first, before the cache is read, so a cached list is charged
 * too. Answered from a 60-second cache shared by every reader; a miss also reserves one unit of the
 * chart-query budget per Cube query it may run and gives back the ones it did not, and each Cube query
 * holds one in-flight chart query slot while it runs (429 when they are all taken). A miss is built once:
 * requests for the same list in this process share one build, and across instances the one holding the
 * list's lock builds it while the others wait briefly for its cached result.
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
    // Charged here rather than by the route wrapper, so an MCP call pays the same, and never twice.
    const limited = await applyV3OperationRateLimit({ config: rateLimitConfigs.api.v3, ...context });
    if (limited) return limited;

    const resolved = await resolveValueListRequest({ dashboardId, filterId, query, context });
    if (resolved instanceof Response) return resolved;
    const { row, access, actor, filter, locked, charts, datasetHasField, dateRange, requested } = resolved;

    const picks = keepCurrentPicks(locked.filters, locked.picks);
    const { [filter.id]: _ownPick, ...otherPicks } = picks;
    const { cacheKey, lockKey } = valuesCacheKey({
      dashboardId,
      updatedAt: row.updatedAt,
      charts: row.widgets.map(({ chart }) => ({ id: chart.id, updatedAt: chart.updatedAt })),
      filterId,
      filters: locked.filters,
      otherPicks,
      dateRange,
      search: query.search,
    });

    const cached = await cache.get<TV3DashboardFilterValues>(cacheKey);
    if (cached.ok && cached.data) return successResponse(cached.data, { requestId });

    const plan = {
      filter,
      filters: locked.filters,
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

    const run = createValueQueryRunner({
      workspaceId: access.workspaceId,
      organizationId: access.organizationId,
      actor,
    });

    const build = async (): Promise<TBuiltList> => {
      const reserved = await reserveV3OperationRateLimit({
        config: rateLimitConfigs.api.v3ChartQueries,
        ...context,
        requested: queries.length + 2 * groups.length,
      });
      if ("refused" in reserved) return reserved;

      const slotted = createSlottedRunner(context, run);
      const counted = slotted.run;
      try {
        // First the merged value queries and the bounded charts' own queries, sharing one concurrency
        // limit; then, for each bounded chart not grouped by the field, its values within its groups.
        const firstStep = await mapWithConcurrency(
          [...queries, ...groups],
          FILTER_VALUE_QUERY_CONCURRENCY,
          counted
        );
        const results = firstStep.slice(0, queries.length);
        const groupRows = firstStep.slice(queries.length);
        const resolved = groups.map((group, index) =>
          resolveBoundedChartValues({ filter, group, rows: groupRows[index], search: query.search })
        );
        const { secondStep, groupValues } = splitBoundedOutcomes(resolved, filter.field);
        const secondResults = await mapWithConcurrency(secondStep, FILTER_VALUE_QUERY_CONCURRENCY, counted);

        const data: TV3DashboardFilterValues = mergeFilterValues(filter.field, [
          ...results,
          ...groupValues,
          ...secondResults,
        ]);
        const stored = await cache.set(cacheKey, data, FILTER_VALUES_CACHE_TTL_MS);
        if (!stored.ok) log.warn({ error: stored.error }, "Could not cache a dashboard filter's values");
        return { data };
      } catch (error) {
        if (error instanceof FilterValuesSlotRefused) return { refused: error.refused };
        throw error;
      } finally {
        await reserved.settle(slotted.ran());
      }
    };

    // Only one principal's requests share a build: the build reserves that principal's chart-query
    // budget and slots, so another principal joining it would get the first one's refusal. The cached
    // list and its lock stay shared by everyone.
    const buildKey = principalBuildKey(cacheKey, context);
    const outcome = await runOnce(buildKey, () => buildUnderListLock({ cacheKey, lockKey }, build));
    // A refusal is shared by every request that joined the build, so each sends its own copy.
    return "refused" in outcome ? outcome.refused.clone() : successResponse(outcome.data, { requestId });
  } catch (error) {
    if (error instanceof CubeQueryError) {
      log.warn(loggableError(error), "A dashboard filter's value lookup failed in Cube");
      return problemBadGateway(
        requestId,
        error.timedOut
          ? "The value lookup took too long and was stopped."
          : "The values could not be looked up. Try again shortly.",
        instance
      );
    }
    return (
      refuseUnreadableLockedFilters(error, { dashboardId, log, requestId, instance }) ??
      mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.filterValues" })
    );
  }
}
