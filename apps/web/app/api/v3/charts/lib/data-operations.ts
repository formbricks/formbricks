import "server-only";
import { logger } from "@formbricks/logger";
import type { TChartQuery, TCubeFilter } from "@formbricks/types/analysis";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { applyV3OperationRateLimit, withV3OperationSlot } from "@/app/api/v3/lib/operation-rate-limit";
import {
  type InvalidParam,
  problemBadGateway,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganization } from "@/lib/organization/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import type { TCubeQuerySource } from "@/modules/ee/analysis/api/lib/cube-config";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import {
  COLLECTED_AT_DIMENSION,
  applyDashboardDateFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import { narrowWithFilters } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import {
  type TRequestedDateRangeNames,
  checkTimeBucketLimit,
  parseRequestedDateRange,
  validateChartQuery,
} from "@/modules/ee/analysis/lib/chart-query-validator";
import { collectEmbeddedMemberNames } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TDatasetChartFields } from "@/modules/ee/analysis/lib/field-catalog";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { type TV3ChartOperationContext, loadAuthorizedChart } from "./access";
import { loadDatasetChartFields } from "./dataset-fields";
import { refuseChartQuery } from "./problems";
import type { TV3ChartData } from "./resources";
import type { TV3ChartDataQuery, TV3ChartPreviewBody } from "./schemas";

/**
 * The chart query operations — preview, data and (in field-operations) field values. They share one
 * budget, 600 per minute per user or API key, instead of the v3 default: every dashboard widget fetches
 * its own data, so a dashboard load is one query per chart (ADR 0002). The budget is charged here rather
 * than by the route wrapper, so an MCP call spends from the same one.
 */
export const applyChartQueryRateLimit = (context: TV3ChartOperationContext): Promise<Response | null> =>
  applyV3OperationRateLimit({ config: rateLimitConfigs.api.v3ChartQueries, ...context });

/** Run a Cube query holding one of the caller's in-flight chart query slots. */
export const withChartQuerySlot = (
  context: TV3ChartOperationContext,
  query: () => Promise<Response>
): Promise<Response> =>
  withV3OperationSlot({ config: rateLimitConfigs.api.v3ChartQueriesInFlight, ...context }, query);

/**
 * A chart query that could not run: Cube unreachable, rejected, or out of time. Cube's own error never
 * reaches the caller — it can name members or infrastructure — only whether it timed out.
 */
const cubeFailure = (error: CubeQueryError, { requestId, instance }: TV3ChartOperationContext): Response =>
  problemBadGateway(
    requestId,
    error.timedOut
      ? "The chart query took too long and was stopped. Narrow the date range or the grouping and try again."
      : "The chart query could not be run. Try again shortly.",
    instance
  );

/** The zone an organization's calendar days are cut in, as Cube reads every date range of its charts. */
export const getOrganizationReportingTimeZone = async (organizationId: string): Promise<string> =>
  getReportingTimeZone((await getOrganization(organizationId))?.displayTimeZone);

/** The answer for a chart whose filters let nothing through: no rows, and Cube is never asked. */
export const emptyChartData = (query: TChartQuery): TV3ChartData => ({
  rows: [],
  optionLabels: {},
  fieldLabels: {},
  memberLabels: {},
  query: query as TV3ChartData["query"],
});

/**
 * The embedded-data members the rows are keyed by, to each key's own name (ENG-6893), so a column or
 * legend reads `Plan` rather than `FeedbackRecords.ed_plan_64879f7d`.
 */
const getMemberLabels = (
  query: unknown,
  dataset: TDatasetChartFields | undefined
): Record<string, string> => {
  const named = new Set(collectEmbeddedMemberNames(query));
  return Object.fromEntries(
    (dataset?.embeddedFields ?? []).filter(({ name }) => named.has(name)).map(({ name, key }) => [name, key])
  );
};

/**
 * Validate, narrow to the requested date range, shape for the chart type, and run — the part preview and
 * data share once the caller is authorized for the dataset. `query` is caller input for a preview and
 * the stored query for a saved chart; both go through the validator, so a stored query that no longer
 * passes it answers 422 rather than reaching Cube. A requested range is ANDed with the saved one
 * (ADR-0024); ranges that do not overlap answer an empty chart. The time-bucket limit is checked once, on
 * the query that will run, and a narrowed range too wide for the chart's granularity is named as
 * `dateRange`. `extraFilters` (a dashboard's filter picks) are ANDed onto the saved filters the same way,
 * and `respond` shapes the success body.
 */
export async function runV3ChartQuery({
  access,
  datasetId,
  type,
  query,
  dateRange,
  source,
  context,
  dateRangeNames,
  extraFilters = [],
  respond = (data) => data,
}: {
  access: V3WorkspaceContext;
  datasetId: string;
  type: TChartType;
  query: unknown;
  dateRange: unknown;
  source: TCubeQuerySource;
  context: TV3ChartOperationContext;
  /** What the caller calls the date range: the data routes take query parameters, the preview a body field. */
  dateRangeNames?: TRequestedDateRangeNames;
  extraFilters?: TCubeFilter[];
  respond?: (data: TV3ChartData) => object;
}): Promise<Response> {
  // Reads take the relative ranges older charts were saved with: a saved chart's, and a preview of one being
  // edited in the builder. Nothing is saved here; a write keeps such a range only if its chart already had it.
  const dataset = await loadDatasetChartFields(context.authentication, access, datasetId, query);
  const validated = validateChartQuery(query, { timeBuckets: false, legacyDateRanges: true, dataset });
  // The data route takes the range as query parameters; the preview takes it as one body field.
  const requested = parseRequestedDateRange(dateRange, dateRangeNames);
  const invalidParams: InvalidParam[] = [
    ...(validated.ok ? [] : validated.issues),
    ...(requested.ok ? [] : requested.issues),
  ];
  if (!validated.ok) return refuseChartQuery(invalidParams, context);
  if (!requested.ok) return refuseChartQuery(invalidParams, context, "The date range is not valid");

  const actor = getV3AuthorizationActor(context.authentication);
  if (!actor) return problemUnauthorized(context.requestId, "Not authenticated", context.instance);

  const narrowed = applyDashboardDateFilter(
    narrowWithFilters(validated.query, extraFilters),
    requested.filter,
    { timeZone: await getOrganizationReportingTimeZone(access.organizationId) }
  );
  if (!narrowed) {
    return successResponse(respond(emptyChartData(validated.query)), { requestId: context.requestId });
  }
  const runnable = prepareQueryForChartType(narrowed, type);
  const bucketIssue = checkTimeBucketLimit(runnable, (index) =>
    requested.filter && runnable.timeDimensions?.[index]?.dimension === COLLECTED_AT_DIMENSION
      ? "dateRange"
      : `query.timeDimensions[${index}].dateRange`
  );
  if (bucketIssue) return refuseChartQuery([bucketIssue], context);

  return withChartQuerySlot(context, async () => {
    try {
      const run = await runChartQuery({
        query: runnable,
        datasetId,
        workspaceId: access.workspaceId,
        organizationId: access.organizationId,
        actor,
        source,
      });

      const data: TV3ChartData = {
        rows: run.rows as TV3ChartData["rows"],
        optionLabels: run.optionLabels ?? {},
        fieldLabels: run.fieldLabels ?? {},
        memberLabels: getMemberLabels(run.effectiveQuery, dataset),
        query: run.effectiveQuery as TV3ChartData["query"],
      };
      return successResponse(respond(data), { requestId: context.requestId });
    } catch (error) {
      if (error instanceof CubeQueryError) return cubeFailure(error, context);
      throw error;
    }
  });
}

/**
 * `POST /api/v3/charts/preview` → 200 `{ data: { rows, optionLabels, fieldLabels, query } }`.
 *
 * Runs an unsaved chart, so an agent can check it shows what was meant before saving it. Saves nothing.
 */
export async function previewV3Chart({
  body,
  ...context
}: TV3ChartOperationContext & { body: TV3ChartPreviewBody }): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, workspaceId: body.workspaceId });

  try {
    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const access = await requireDashboardsAccess(
      context.authentication,
      body.workspaceId,
      "read",
      context.requestId,
      context.instance
    );
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      context.authentication,
      access,
      body.datasetId,
      "read",
      context.requestId,
      context.instance
    );
    if (refused) return refused;

    return await runV3ChartQuery({
      access,
      datasetId: body.datasetId,
      type: body.type,
      query: body.query,
      dateRange: body.dateRange,
      source: "v3.charts.preview",
      context,
    });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "charts.preview",
    });
  }
}

/** The data routes take the range as query parameters, named as the caller sent them. */
export const DATA_ROUTE_DATE_RANGE_NAMES: TRequestedDateRangeNames = {
  dateRange: "dateRange",
  from: "from",
  to: "to",
};

/**
 * The requested date range from the data route's query parameters: `dateRange`, or `from` and `to`
 * together. Mixing the two, or sending one of the pair, is refused like any other invalid range.
 */
export const requestedDateRangeOf = (
  query: Pick<TV3ChartDataQuery, "dateRange" | "from" | "to">
): unknown => {
  const hasPair = query.from !== undefined || query.to !== undefined;
  if (!hasPair) return query.dateRange;
  if (query.dateRange !== undefined) return { dateRange: query.dateRange, from: query.from, to: query.to };
  return { from: query.from, to: query.to };
};

/**
 * `GET /api/v3/charts/{chartId}/data` → 200 `{ data: { rows, optionLabels, fieldLabels, query } }`.
 *
 * A requested date range narrows the chart's own on `collectedAt` — the dashboard date filter's rule
 * (ADR-0024) — so the numbers match what a person sees on a dashboard filtered the same way; `all-time` and
 * no range leave the saved range as it is. Needs read access to the chart's workspace and to its Feedback
 * Dataset: a dashboards grant alone never reaches respondents' answers.
 */
export async function getV3ChartData({
  chartId,
  query,
  ...context
}: TV3ChartOperationContext & { chartId: string; query: TV3ChartDataQuery }): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, chartId });

  try {
    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const loaded = await loadAuthorizedChart(chartId, "read", context, { datasetPermission: "read" });
    if (loaded instanceof Response) return loaded;

    return await runV3ChartQuery({
      access: loaded.access,
      datasetId: loaded.row.feedbackDirectoryId,
      type: loaded.row.type,
      query: loaded.row.query,
      dateRange: requestedDateRangeOf(query),
      source: "v3.charts.data",
      dateRangeNames: DATA_ROUTE_DATE_RANGE_NAMES,
      context,
    });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "charts.data",
    });
  }
}
