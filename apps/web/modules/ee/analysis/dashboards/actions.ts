"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZWidgetLayout } from "@formbricks/types/dashboard";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { checkProjectAccess } from "@/modules/ee/analysis/lib/access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZDashboardUpdateInput } from "../types/analysis";
import {
  addChartToDashboard,
  createDashboard,
  deleteDashboard,
  getDashboard,
  getDashboards,
  updateDashboard,
} from "./lib/dashboards";

const ZCreateDashboardAction = z.object({
  environmentId: ZId,
  name: z.string().min(1),
  description: z.string().optional(),
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
        description: parsedInput.description,
        createdBy: ctx.user.id,
      });

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
        description: parsedInput.description,
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = parsedInput.dashboardId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      return { success: true };
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
  title: z.string().optional(),
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
        title: parsedInput.title,
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
