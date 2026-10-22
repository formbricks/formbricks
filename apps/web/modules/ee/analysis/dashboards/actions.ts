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
import {
  addChartToDashboard,
  getDashboard,
  getDashboards,
  removeWidgetFromDashboard,
  updateWidgetLayouts,
} from "./lib/dashboards";
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

const ZGetDashboardAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
});

export const getDashboardAction = authenticatedActionClient
  .inputSchema(ZGetDashboardAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetDashboardAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "read"
      );
      await checkDashboardsEnabled(organizationId);

      return getDashboard(parsedInput.dashboardId, workspaceId);
    }
  );

const ZAddChartToDashboardAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
  chartId: ZId,
  layout: ZWidgetLayout.optional(),
  respectY: z.boolean().optional(),
});

export const addChartToDashboardAction = authenticatedActionClient
  .inputSchema(ZAddChartToDashboardAction)
  .action(
    withAuditLogging(
      "created",
      "dashboardWidget",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZAddChartToDashboardAction>;
      }) => {
        const { organizationId, workspaceId } = await checkWorkspaceAccess(
          ctx.user.id,
          parsedInput.workspaceId,
          "readWrite"
        );
        await checkDashboardsEnabled(organizationId);

        const widget = await addChartToDashboard({
          dashboardId: parsedInput.dashboardId,
          chartId: parsedInput.chartId,
          workspaceId,
          layout: parsedInput.layout,
          respectY: parsedInput.respectY,
        });

        revalidatePath(`/workspaces/${workspaceId}/dashboards/${parsedInput.dashboardId}`);
        revalidatePath(`/workspaces/${workspaceId}/dashboards`);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
        ctx.auditLoggingCtx.newObject = widget;
        return widget;
      }
    )
  );

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

const ZRemoveWidgetFromDashboardAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
  widgetId: ZId,
});

export const removeWidgetFromDashboardAction = authenticatedActionClient
  .inputSchema(ZRemoveWidgetFromDashboardAction)
  .action(
    withAuditLogging("deleted", "dashboardWidget", async ({ ctx, parsedInput }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const widget = await removeWidgetFromDashboard(
        parsedInput.dashboardId,
        workspaceId,
        parsedInput.widgetId
      );

      revalidatePath(`/workspaces/${workspaceId}/dashboards/${parsedInput.dashboardId}`);
      revalidatePath(`/workspaces/${workspaceId}/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
      ctx.auditLoggingCtx.oldObject = widget;
      return { success: true };
    })
  );
