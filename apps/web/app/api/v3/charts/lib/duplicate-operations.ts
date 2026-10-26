import "server-only";
import { logger } from "@formbricks/logger";
import { getDashboardWorkspaceRow } from "@/app/api/v3/dashboards/lib/service";
import { createWithCopyNameRetries } from "@/app/api/v3/lib/copy-name-retry";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { createdResponse, problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { type TV3ChartOperationContext, getSessionUserId, loadAuthorizedChart } from "./access";
import type { TV3ChartDuplicateBody } from "./duplicate-schemas";
import { duplicateChartRow } from "./duplicate-service";
import { chartNameTaken, dashboardFull, refuseMatrixUntilUpgraded } from "./problems";
import { serializeV3Chart } from "./serializers";

/**
 * `POST /api/v3/charts/{chartId}/duplicate` → 201 `{ data }` with `Location`.
 *
 * Copies a chart so the copy can change without touching the dashboards that show the original. With a
 * `dashboardId` the copy is put on that dashboard in the same transaction — in the first open slot, or
 * at `layout` — so a failure never leaves a copy on no dashboard. Needs write access to the chart's
 * workspace and to its Feedback Dataset; the dashboard must be in the same workspace.
 */
export async function duplicateV3Chart({
  chartId,
  body,
  auditLog,
  ...context
}: TV3ChartOperationContext & {
  chartId: string;
  body: TV3ChartDuplicateBody;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, chartId });

  try {
    const loaded = await loadAuthorizedChart(chartId, "readWrite", context, {
      datasetPermission: "readWrite",
    });
    if (loaded instanceof Response) return loaded;

    const refused = await refuseMatrixUntilUpgraded(loaded.row.type, context);
    if (refused) return refused;

    if (body.dashboardId) {
      const dashboard = await getDashboardWorkspaceRow(body.dashboardId);
      if (dashboard?.workspaceId !== loaded.row.workspaceId) {
        return problemForbidden(requestId, undefined, instance);
      }
    }

    const created = await createWithCopyNameRetries(
      () =>
        duplicateChartRow({
          sourceId: chartId,
          name: body.name,
          createdBy: getSessionUserId(authentication),
          dashboardId: body.dashboardId,
          layout: body.layout,
        }),
      { nameChosen: body.name !== undefined }
    );
    if (created.nameTaken) return chartNameTaken(context);

    const result = created.value;
    if (result.kind === "gone") return problemForbidden(requestId, undefined, instance);
    if (result.kind === "full") return dashboardFull(context);
    if (result.kind === "overlap") {
      return problemUnprocessableContent(requestId, "The layout overlaps another widget", {
        instance,
        invalid_params: [
          {
            name: "layout",
            reason: `Overlaps widget ${result.widgetId}. Widgets may leave gaps but not overlap: pick a free position, or leave layout out to use the first open slot.`,
          },
        ],
      });
    }

    const chart = serializeV3Chart(result.row);
    if (auditLog) {
      auditLog.targetId = chart.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.newObject = {
        ...chart,
        duplicatedFrom: chartId,
        ...(body.dashboardId ? { dashboardId: body.dashboardId, widgetId: result.widgetId } : {}),
      };
    }

    return createdResponse(chart, { location: `/api/v3/charts/${chart.id}`, requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.duplicate" });
  }
}
