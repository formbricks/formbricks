import "server-only";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  buildKeysetPage,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateChartQuery } from "@/modules/ee/analysis/lib/chart-query-validator";
import { type TV3ChartOperationContext, getSessionUserId, loadAuthorizedChart } from "./access";
import { chartNameTaken, refuseChartQuery, refuseMatrixUntilUpgraded } from "./problems";
import type { TV3ChartCreateBody, TV3ChartListQuery, TV3ChartUpdateBody } from "./schemas";
import { serializeV3Chart } from "./serializers";
import {
  type TChartResourceRow,
  type TChartWrite,
  createChartRow,
  listChartResourceRows,
  updateChartRow,
} from "./service";

type TV3ChartWriteContext = TV3ChartOperationContext & { auditLog?: TV3AuditLog };

const CHARTS_CURSOR_KIND = "charts";
const CHARTS_SORT = "-createdAt";

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

/**
 * `POST /api/v3/charts` → 201 `{ data }` with `Location`.
 *
 * Needs write access to the workspace and to the Feedback Dataset the chart will read: a chart is a
 * standing query over that dataset, so creating one is a write against it, not just a read.
 */
export async function createV3Chart({
  body,
  auditLog,
  ...context
}: TV3ChartWriteContext & { body: TV3ChartCreateBody }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      body.datasetId,
      "readWrite",
      requestId,
      instance
    );
    if (refused) return refused;

    const validated = validateChartQuery(body.query);
    if (!validated.ok) return refuseChartQuery(validated.issues, context);

    const matrixRefused = await refuseMatrixUntilUpgraded(body.type, context);
    if (matrixRefused) return matrixRefused;

    let row: TChartResourceRow;
    try {
      row = await createChartRow({
        workspaceId: access.workspaceId,
        datasetId: body.datasetId,
        name: body.name,
        type: body.type,
        query: validated.query as TChartWrite["query"],
        config: body.config ?? {},
        createdBy: getSessionUserId(authentication),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return chartNameTaken(context);
      throw error;
    }

    const chart = serializeV3Chart(row);
    if (auditLog) {
      auditLog.targetId = chart.id;
      auditLog.organizationId = access.organizationId;
      auditLog.newObject = chart;
    }

    const sessionUserId = getSessionUserId(authentication);
    if (sessionUserId) {
      capturePostHogEvent(
        sessionUserId,
        "chart_created",
        { chart_id: chart.id },
        { organizationId: access.organizationId, workspaceId: access.workspaceId }
      );
    }

    return createdResponse(chart, { location: `/api/v3/charts/${chart.id}`, requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.create" });
  }
}

/**
 * `PATCH /api/v3/charts/{chartId}` → 200 `{ data }`.
 *
 * Needs write access to the chart's workspace. The chart may sit on several dashboards, and the edit
 * shows on every one of them — `dashboards` in the response names them.
 */
export async function updateV3Chart({
  chartId,
  body,
  auditLog,
  ...context
}: TV3ChartWriteContext & { chartId: string; body: TV3ChartUpdateBody }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, chartId });

  try {
    const loaded = await loadAuthorizedChart(chartId, "readWrite", context);
    if (loaded instanceof Response) return loaded;

    const update: Partial<TChartWrite> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.config !== undefined) update.config = body.config;
    if (body.query !== undefined) {
      const validated = validateChartQuery(body.query);
      if (!validated.ok) return refuseChartQuery(validated.issues, context);
      update.query = validated.query as TChartWrite["query"];
    }

    if (Object.keys(update).length === 0) {
      return problemBadRequest(requestId, "Nothing to update", {
        instance,
        invalid_params: [{ name: "body", reason: "Send at least one of name, type, query or config." }],
      });
    }

    const matrixRefused = await refuseMatrixUntilUpgraded(body.type, context);
    if (matrixRefused) return matrixRefused;

    let row: TChartResourceRow;
    try {
      row = await updateChartRow(chartId, update);
    } catch (error) {
      if (isUniqueConstraintError(error)) return chartNameTaken(context);
      // Deleted since it was loaded: the same 403 as a chart that never existed.
      if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
        return problemForbidden(requestId, undefined, instance);
      }
      throw error;
    }

    const chart = serializeV3Chart(row);
    if (auditLog) {
      auditLog.targetId = chart.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = serializeV3Chart(loaded.row);
      auditLog.newObject = chart;
    }

    return successResponse(chart, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.update" });
  }
}
