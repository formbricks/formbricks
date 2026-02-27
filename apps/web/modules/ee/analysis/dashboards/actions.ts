"use server";

// eslint-disable-next-line
// TODO: remove revalidatePath and use revalidateTag instead once this has become stable: https://nextjs.org/docs/app/api-reference/directives/use-cache#usage
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZWidgetLayout } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { checkProjectAccess } from "@/modules/ee/analysis/lib/access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZDashboardUpdateInput } from "../types/analysis";
import {
  addChartToDashboard,
  createDashboard,
  deleteDashboard,
  duplicateDashboard,
  getDashboard,
  getDashboards,
  updateDashboard,
  updateWidgetLayouts,
} from "./lib/dashboards";

const ZCreateDashboardAction = z.object({
  environmentId: ZId,
  name: z.string().min(1),
});

export const createDashboardAction = authenticatedActionClient.schema(ZCreateDashboardAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const dashboard = await createDashboard({
        projectId,
        name: parsedInput.name,
        createdBy: ctx.user.id,
      });

      revalidatePath(`/environments/${parsedInput.environmentId}/analysis/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = dashboard.id;
      ctx.auditLoggingCtx.newObject = dashboard;
      return dashboard;
    }
  )
);

const ZUpdateDashboardAction = z
  .object({
    environmentId: ZId,
    dashboardId: ZId,
  })
  .merge(ZDashboardUpdateInput);

export const updateDashboardAction = authenticatedActionClient.schema(ZUpdateDashboardAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const { dashboard, updatedDashboard } = await updateDashboard(parsedInput.dashboardId, projectId, {
        name: parsedInput.name,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      ctx.auditLoggingCtx.newObject = updatedDashboard;
      return updatedDashboard;
    }
  )
);

const ZUpdateWidgetLayoutsAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
  widgets: z
    .array(
      z.object({
        id: ZId,
        layout: ZWidgetLayout,
        order: z.number().int().nonnegative(),
      })
    )
    .min(1),
});

export const updateWidgetLayoutsAction = authenticatedActionClient.schema(ZUpdateWidgetLayoutsAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const dashboard = await getDashboard(parsedInput.dashboardId, projectId);

      await updateWidgetLayouts(parsedInput.dashboardId, projectId, parsedInput.widgets);

      const updatedDashboard = await getDashboard(parsedInput.dashboardId, projectId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      ctx.auditLoggingCtx.newObject = updatedDashboard;
      return { ok: true };
    }
  )
);

const ZDeleteDashboardAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
});

export const deleteDashboardAction = authenticatedActionClient.schema(ZDeleteDashboardAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const dashboard = await deleteDashboard(parsedInput.dashboardId, projectId);

      revalidatePath(`/environments/${parsedInput.environmentId}/analysis/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      return { success: true };
    }
  )
);

const ZDuplicateDashboardAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
});

export const duplicateDashboardAction = authenticatedActionClient.schema(ZDuplicateDashboardAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const dashboard = await duplicateDashboard(parsedInput.dashboardId, projectId, ctx.user.id);

      revalidatePath(`/environments/${parsedInput.environmentId}/analysis/dashboards`);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = dashboard.id;
      ctx.auditLoggingCtx.newObject = dashboard;
      return dashboard;
    }
  )
);

const ZGetDashboardsAction = z.object({
  environmentId: ZId,
});

export const getDashboardsAction = authenticatedActionClient
  .schema(ZGetDashboardsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetDashboardsAction>;
    }) => {
      const { projectId } = await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      return getDashboards(projectId);
    }
  );

const ZGetDashboardAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
});

export const getDashboardAction = authenticatedActionClient
  .schema(ZGetDashboardAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetDashboardAction>;
    }) => {
      const { projectId } = await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      return getDashboard(parsedInput.dashboardId, projectId);
    }
  );

const ZAddChartToDashboardAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
  chartId: ZId,
  layout: ZWidgetLayout.optional().default({ x: 0, y: 0, w: 4, h: 3 }),
});

export const addChartToDashboardAction = authenticatedActionClient.schema(ZAddChartToDashboardAction).action(
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const widget = await addChartToDashboard({
        dashboardId: parsedInput.dashboardId,
        chartId: parsedInput.chartId,
        projectId,
        layout: parsedInput.layout,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
      ctx.auditLoggingCtx.newObject = widget;
      return widget;
    }
  )
);
