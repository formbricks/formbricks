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
import { ZDashboardUpdateInput } from "../types/analysis";
import {
  addChartToDashboard,
  createDashboard,
  deleteDashboard,
  duplicateDashboard,
  getDashboard,
  getDashboards,
  removeWidgetFromDashboard,
  updateDashboard,
  updateWidgetLayouts,
} from "./lib/dashboards";

const checkDashboardsEnabled = async (organizationId: string) => {
  const isAllowed = await getIsDashboardsEnabled(organizationId);
  if (!isAllowed) {
    throw new OperationNotAllowedError("Dashboards are not enabled for this organization");
  }
};

const ZCreateDashboardAction = z.object({
  workspaceId: ZId,
  name: z.string().min(1),
});

export const createDashboardAction = authenticatedActionClient.inputSchema(ZCreateDashboardAction).action(
  withAuditLogging(
    "created",
    "dashboard",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateDashboardAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const dashboard = await createDashboard({
        workspaceId,
        name: parsedInput.name,
        createdBy: ctx.user.id,
      });

      revalidatePath(`/workspaces/${workspaceId}/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.dashboardId = dashboard.id;
      ctx.auditLoggingCtx.newObject = dashboard;
      return dashboard;
    }
  )
);

const ZUpdateDashboardAction = z
  .object({
    workspaceId: ZId,
    dashboardId: ZId,
  })
  .merge(ZDashboardUpdateInput);

export const updateDashboardAction = authenticatedActionClient.inputSchema(ZUpdateDashboardAction).action(
  withAuditLogging(
    "updated",
    "dashboard",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateDashboardAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const { dashboard, updatedDashboard } = await updateDashboard(parsedInput.dashboardId, workspaceId, {
        name: parsedInput.name,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      ctx.auditLoggingCtx.newObject = updatedDashboard;
      return updatedDashboard;
    }
  )
);

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

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
        ctx.auditLoggingCtx.oldObject = dashboard;
        ctx.auditLoggingCtx.newObject = updatedDashboard;
        return { ok: true };
      }
    )
  );

const ZDeleteDashboardAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
});

export const deleteDashboardAction = authenticatedActionClient.inputSchema(ZDeleteDashboardAction).action(
  withAuditLogging(
    "deleted",
    "dashboard",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteDashboardAction>;
    }) => {
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );
      await checkDashboardsEnabled(organizationId);

      const dashboard = await deleteDashboard(parsedInput.dashboardId, workspaceId);

      revalidatePath(`/workspaces/${workspaceId}/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      return { success: true };
    }
  )
);

const ZDuplicateDashboardAction = z.object({
  workspaceId: ZId,
  dashboardId: ZId,
});

export const duplicateDashboardAction = authenticatedActionClient
  .inputSchema(ZDuplicateDashboardAction)
  .action(
    withAuditLogging(
      "created",
      "dashboard",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZDuplicateDashboardAction>;
      }) => {
        const { organizationId, workspaceId } = await checkWorkspaceAccess(
          ctx.user.id,
          parsedInput.workspaceId,
          "readWrite"
        );
        await checkDashboardsEnabled(organizationId);

        const dashboard = await duplicateDashboard(parsedInput.dashboardId, workspaceId, ctx.user.id);

        revalidatePath(`/workspaces/${workspaceId}/dashboards`);

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.dashboardId = dashboard.id;
        ctx.auditLoggingCtx.newObject = dashboard;
        return dashboard;
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
  layout: ZWidgetLayout.optional().default({ x: 0, y: 0, w: 4, h: 3 }),
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
        });

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.workspaceId = workspaceId;
        ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
        ctx.auditLoggingCtx.newObject = widget;
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
      ctx.auditLoggingCtx.oldObject = widget;
      return { success: true };
    })
  );
