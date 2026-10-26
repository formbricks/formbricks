import "server-only";
import { logger } from "@formbricks/logger";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import {
  type InvalidParam,
  problemBadGateway,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import type { TCubeQuerySource } from "@/modules/ee/analysis/api/lib/cube-config";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import {
  COLLECTED_AT_DIMENSION,
  applyDashboardDateFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import {
  checkTimeBucketLimit,
  parseRequestedDateRange,
  validateChartQuery,
} from "@/modules/ee/analysis/lib/chart-query-validator";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { type TV3ChartOperationContext, loadAuthorizedChart } from "./access";
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

/**
 * Validate, apply the requested date range, shape for the chart type, and run — the part preview and
 * data share once the caller is authorized for the dataset. `query` is caller input for a preview and
 * the stored query for a saved chart; both go through the validator, so a stored query that no longer
 * passes it answers 422 rather than reaching Cube. The time-bucket limit is checked once, on the query
 * that will run: a requested range replaces the saved one, so a saved range it replaces cannot refuse
 * the read, and a requested range too wide for the chart's granularity is named as `dateRange`.
 */
export async function runV3ChartQuery({
  access,
  datasetId,
  type,
  query,
  dateRange,
  source,
  context,
}: {
  access: V3WorkspaceContext;
  datasetId: string;
  type: TChartType;
  query: unknown;
  dateRange: unknown;
  source: TCubeQuerySource;
  context: TV3ChartOperationContext;
}): Promise<Response> {
  // A saved chart may hold a relative range older charts were saved with; a preview's query is new input.
  const validated = validateChartQuery(query, {
    timeBuckets: false,
    legacyDateRanges: source === "v3.charts.data",
  });
  // The data route takes the range as query parameters; the preview takes it as one body field.
  const requested = parseRequestedDateRange(
    dateRange,
    source === "v3.charts.data" ? { dateRange: "dateRange", from: "from", to: "to" } : undefined
  );
  const invalidParams: InvalidParam[] = [
    ...(validated.ok ? [] : validated.issues),
    ...(requested.ok ? [] : requested.issues),
  ];
  if (!validated.ok) return refuseChartQuery(invalidParams, context);
  if (!requested.ok) return refuseChartQuery(invalidParams, context, "The date range is not valid");

  const actor = getV3AuthorizationActor(context.authentication);
  if (!actor) return problemUnauthorized(context.requestId, "Not authenticated", context.instance);

  const runnable = prepareQueryForChartType(
    applyDashboardDateFilter(validated.query, requested.filter),
    type
  );
  const bucketIssue = checkTimeBucketLimit(runnable, (index) =>
    requested.filter && runnable.timeDimensions?.[index]?.dimension === COLLECTED_AT_DIMENSION
      ? "dateRange"
      : `query.timeDimensions[${index}].dateRange`
  );
  if (bucketIssue) return refuseChartQuery([bucketIssue], context);

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
      query: run.effectiveQuery as TV3ChartData["query"],
    };
    return successResponse(data, { requestId: context.requestId });
  } catch (error) {
    if (error instanceof CubeQueryError) return cubeFailure(error, context);
    throw error;
  }
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

/**
 * The requested date range from the data route's query parameters: `dateRange`, or `from` and `to`
 * together. Mixing the two, or sending one of the pair, is refused like any other invalid range.
 */
const requestedDateRangeOf = (query: TV3ChartDataQuery): unknown => {
  const hasPair = query.from !== undefined || query.to !== undefined;
  if (!hasPair) return query.dateRange;
  if (query.dateRange !== undefined) return { dateRange: query.dateRange, from: query.from, to: query.to };
  return { from: query.from, to: query.to };
};

/**
 * `GET /api/v3/charts/{chartId}/data` → 200 `{ data: { rows, optionLabels, fieldLabels, query } }`.
 *
 * A requested date range replaces the chart's own on `collectedAt` — the dashboard date filter's rule — so
 * the numbers match what a person sees on a dashboard filtered the same way; `all-time` removes it, and
 * without one the saved range applies. Needs read access to the chart's workspace and to its Feedback
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
