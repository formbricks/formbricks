"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZWidgetLayout } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getDashboard, getDashboards, updateWidgetLayouts } from "./lib/dashboards";
import { duplicateChartAndAddWidget } from "./lib/duplicate-chart-and-add-widget";

const checkDashboardsEnabled = async (organizationId: string) => {
  const isAllowed = await getIsDashboardsEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Dashboards are not enabled for this organization");
  }
};

const ZUpdateWidgetLayoutsAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
  widgets: z.array(
    z.object({
      id: ZId,
      layout: ZWidgetLayout,
      order: z.number().int().nonnegative(),
    })
  ),
});

export const updateWidgetLayoutsAction = authenticatedActionClient
  .inputSchema(ZUpdateWidgetLayoutsAction)
  .action(
    withAuditLogging(
      "updated",
      "dashboard",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZUpdateWidgetLayoutsAction>;
      }) => {
        const { organizationId, workspaceId } = await checkWorkspaceAccess(
          ctx.user.id,
          parsedInput.workspaceId,
          "readWrite"
        );
        await checkDashboardsEnabled(organizationId);

        const dashboard = await getDashboard(parsedInput.dashboardId, workspaceId);

        await updateWidgetLayouts(parsedInput.dashboardId, workspaceId, parsedInput.widgets);

        const updatedDashboard = await getDashboard(parsedInput.dashboardId, workspaceId);

        revalidatePath(`/workspaces/${workspaceId}/dashboards/${parsedInput.dashboardId}`);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
        ctx.auditLoggingCtx.oldObject = dashboard;
        ctx.auditLoggingCtx.newObject = updatedDashboard;
        return { ok: true };
      }
    )
  );

const ZGetDashboardsAction = z.object({
  workspaceId: ZId,
  chartId: ZId.optional(),
});

export const getDashboardsAction = authenticatedActionClient
  .inputSchema(ZGetDashboardsAction)
  .action(async ({ ctx, parsedInput }) => {
    const { organizationId, workspaceId } = await checkWorkspaceAccess(
      ctx.user.id,
      parsedInput.workspaceId,
      "read"
    );
    await checkDashboardsEnabled(organizationId);

    return getDashboards(workspaceId, parsedInput.chartId);
  });

const ZDuplicateChartAndAddWidgetAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
  chartId: ZId,
  layout: ZWidgetLayout.optional(),
});

export const duplicateChartAndAddWidgetAction = authenticatedActionClient
  .inputSchema(ZDuplicateChartAndAddWidgetAction)
  .action(
    withAuditLogging(
      "created",
      "dashboardWidget",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZDuplicateChartAndAddWidgetAction>;
      }) => {
        const { organizationId, workspaceId } = await checkWorkspaceAccess(
          ctx.user.id,
          parsedInput.workspaceId,
          "readWrite"
        );
        await checkDashboardsEnabled(organizationId);

        const { chart, widget } = await duplicateChartAndAddWidget({
          dashboardId: parsedInput.dashboardId,
          workspaceId,
          chartId: parsedInput.chartId,
          createdBy: ctx.user.id,
          layout: parsedInput.layout,
        });

        revalidatePath(`/workspaces/${workspaceId}/dashboards/${parsedInput.dashboardId}`);
        revalidatePath(`/workspaces/${workspaceId}/dashboards`);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.chartId = chart.id;
        ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
        ctx.auditLoggingCtx.newObject = { chart, widget };
        return widget;
      }
    )
  );
