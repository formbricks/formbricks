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
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import type { TCubeQuerySource } from "@/modules/ee/analysis/api/lib/cube-config";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { applyDashboardDateFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import {
  DATE_RANGE_REASON,
  parseRequestedDateRange,
  validateChartQuery,
} from "@/modules/ee/analysis/lib/chart-query-validator";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import type { TV3ChartOperationContext } from "./operations";
import type { TV3ChartData } from "./resources";
import type { TV3ChartPreviewBody } from "./schemas";

/**
 * The chart query operations — preview, data and (in field-operations) field values. They share one
 * budget, 600 per minute per user or API key, instead of the v3 default: every dashboard widget fetches
 * its own data, so a dashboard load is one query per chart (ADR 0002). The budget is charged here rather
 * than by the route wrapper, so an MCP call spends from the same one.
 */
export const applyChartQueryRateLimit = (context: TV3ChartOperationContext): Promise<Response | null> =>
  applyV3OperationRateLimit({ config: rateLimitConfigs.api.v3ChartQueries, ...context });

export const refuseChartQuery = (
  invalidParams: InvalidParam[],
  { requestId, instance }: TV3ChartOperationContext
): Response =>
  problemUnprocessableContent(requestId, "The chart query is not valid", {
    instance,
    invalid_params: invalidParams,
  });

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
 * passes it answers 422 rather than reaching Cube.
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
  const validated = validateChartQuery(query);
  const requested = parseRequestedDateRange(dateRange);
  const invalidParams: InvalidParam[] = validated.ok ? [] : [...validated.issues];
  if (!requested.ok) invalidParams.push({ name: "dateRange", reason: DATE_RANGE_REASON });
  if (!validated.ok || !requested.ok) return refuseChartQuery(invalidParams, context);

  const actor = getV3AuthorizationActor(context.authentication);
  if (!actor) return problemUnauthorized(context.requestId, "Not authenticated", context.instance);

  try {
    const run = await runChartQuery({
      query: prepareQueryForChartType(applyDashboardDateFilter(validated.query, requested.filter), type),
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
