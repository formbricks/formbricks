import "server-only";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { dashboardFull } from "@/app/api/v3/charts/lib/problems";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { type TV3DashboardOperationContext, authorizeLoadedDashboard } from "./access";
import type { TV3WidgetCreateBody, TV3WidgetUpdateBody } from "./schemas";
import { serializeV3DashboardWidget } from "./serializers";
import { getDashboardWorkspaceRow, getWidgetResourceRow } from "./service";
import {
  type TWidgetWriteResult,
  addWidgetRow,
  deleteWidgetRow,
  getChartTypeInWorkspace,
  updateWidgetRow,
} from "./widget-service";

/**
 * The widget operations: put a chart on a dashboard, move it, point it at another chart, take it off.
 * Each needs write access to the dashboard's workspace, and the chart must live in that workspace too — a
 * chart from anywhere else answers the same 403 as one that does not exist.
 */

type TV3WidgetWriteContext = TV3DashboardOperationContext & { auditLog?: TV3AuditLog };

const chartAlreadyOnDashboard = ({ requestId, instance }: TV3DashboardOperationContext): Response =>
  problemConflict(
    requestId,
    "This chart is already on the dashboard. A chart appears at most once per dashboard.",
    instance
  );

const overlapsWidget = (widgetId: string, { requestId, instance }: TV3DashboardOperationContext) =>
  problemUnprocessableContent(requestId, "The layout overlaps another widget", {
    instance,
    invalid_params: [
      {
        name: "layout",
        reason: `Overlaps widget ${widgetId}. Widgets may leave gaps but not overlap: pick a free position, or move that widget first.`,
      },
    ],
  });

/** A widget write that did not happen, as the response that says why. */
const refuseWidgetWrite = (
  result: Exclude<TWidgetWriteResult, { kind: "ok" }>,
  context: TV3DashboardOperationContext
): Response => {
  switch (result.kind) {
    case "duplicate":
      return chartAlreadyOnDashboard(context);
    case "overlap":
      return overlapsWidget(result.widgetId, context);
    case "full":
      return dashboardFull(context);
    case "gone":
      return problemForbidden(context.requestId, undefined, context.instance);
  }
};

/**
 * Runs a widget write, answering a concurrent add of the same chart as the 409 it is, and a chart deleted
 * between its check and the write as the 403 a missing chart gets.
 */
const runWidgetWrite = async (write: () => Promise<TWidgetWriteResult>): Promise<TWidgetWriteResult> => {
  try {
    return await write();
  } catch (error) {
    if (isUniqueConstraintError(error)) return { kind: "duplicate" };
    if (isPrismaKnownRequestError(error, PrismaErrorType.ForeignKeyConstraintViolation))
      return { kind: "gone" };
    throw error;
  }
};

const loadDashboardForWrite = async (dashboardId: string, context: TV3DashboardOperationContext) =>
  authorizeLoadedDashboard(await getDashboardWorkspaceRow(dashboardId), "readWrite", context);

/**
 * `POST /api/v3/dashboards/{dashboardId}/widgets` → 201 `{ data }`. Without a `layout` the chart lands in
 * the first open slot at its type's default size.
 */
export async function addV3DashboardWidget({
  dashboardId,
  body,
  auditLog,
  ...context
}: TV3WidgetWriteContext & { dashboardId: string; body: TV3WidgetCreateBody }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    const chartType = await getChartTypeInWorkspace(body.chartId, loaded.access.workspaceId);
    if (!chartType) return problemForbidden(requestId, undefined, instance);

    const result = await runWidgetWrite(() =>
      addWidgetRow({ dashboardId, chartId: body.chartId, chartType, layout: body.layout })
    );
    if (result.kind !== "ok") return refuseWidgetWrite(result, context);

    const widget = serializeV3DashboardWidget(result.widget);
    if (auditLog) {
      auditLog.targetId = widget.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.newObject = { dashboardId, chartId: widget.chartId, layout: widget.layout };
    }

    return createdResponse(widget, {
      location: `/api/v3/dashboards/${dashboardId}/widgets/${widget.id}`,
      requestId,
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.widgets.add" });
  }
}

/**
 * `GET /api/v3/dashboards/{dashboardId}/widgets/{widgetId}` → 200 `{ data }`: the widget an add's
 * `Location` names. Needs read access to the dashboard's workspace; a widget not on that dashboard
 * answers the same 403 as a dashboard the caller cannot see.
 */
export async function getV3DashboardWidget({
  dashboardId,
  widgetId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string; widgetId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, widgetId });

  try {
    const [dashboard, widget] = await Promise.all([
      getDashboardWorkspaceRow(dashboardId),
      getWidgetResourceRow(dashboardId, widgetId),
    ]);
    const loaded = await authorizeLoadedDashboard(dashboard, "read", context);
    if (loaded instanceof Response) return loaded;
    if (!widget) return problemForbidden(requestId, undefined, instance);

    return successResponse(serializeV3DashboardWidget(widget), { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.widgets.get" });
  }
}

/**
 * `PATCH /api/v3/dashboards/{dashboardId}/widgets/{widgetId}` → 200 `{ data }`. Repointing swaps the chart
 * in place — the way to give one dashboard its own copy of a shared chart.
 */
export async function updateV3DashboardWidget({
  dashboardId,
  widgetId,
  body,
  auditLog,
  ...context
}: TV3WidgetWriteContext & {
  dashboardId: string;
  widgetId: string;
  body: TV3WidgetUpdateBody;
}): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, widgetId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    if (body.chartId && !(await getChartTypeInWorkspace(body.chartId, loaded.access.workspaceId))) {
      return problemForbidden(requestId, undefined, instance);
    }

    const result = await runWidgetWrite(() =>
      updateWidgetRow({ dashboardId, widgetId, layout: body.layout, chartId: body.chartId })
    );
    if (result.kind !== "ok") return refuseWidgetWrite(result, context);

    const widget = serializeV3DashboardWidget(result.widget);
    if (auditLog) {
      auditLog.targetId = widget.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = { dashboardId, ...result.previous };
      auditLog.newObject = { dashboardId, chartId: widget.chartId, layout: widget.layout };
    }

    return successResponse(widget, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.widgets.update" });
  }
}

/** `DELETE /api/v3/dashboards/{dashboardId}/widgets/{widgetId}` → 204. The chart stays. */
export async function removeV3DashboardWidget({
  dashboardId,
  widgetId,
  auditLog,
  ...context
}: TV3WidgetWriteContext & { dashboardId: string; widgetId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, widgetId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    const removed = await deleteWidgetRow(dashboardId, widgetId);
    if (!removed) return problemForbidden(requestId, undefined, instance);

    if (auditLog) {
      auditLog.targetId = widgetId;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = { dashboardId, ...removed };
    }

    return noContentResponse({ requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.widgets.remove" });
  }
}
