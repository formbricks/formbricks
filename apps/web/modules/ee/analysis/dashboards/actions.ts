"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZWidgetLayout } from "@formbricks/types/dashboard";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { checkProjectAccess } from "@/modules/ee/analysis/lib/access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

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

      const dashboard = await prisma.dashboard.create({
        data: {
          name: parsedInput.name,
          description: parsedInput.description,
          projectId,
          createdBy: ctx.user.id,
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardId = dashboard.id;
      ctx.auditLoggingCtx.newObject = dashboard;
      return dashboard;
    }
  )
);

const ZUpdateDashboardAction = z.object({
  environmentId: ZId,
  dashboardId: ZId,
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

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

      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
      });

      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", parsedInput.dashboardId);
      }

      const updatedDashboard = await prisma.dashboard.update({
        where: { id: parsedInput.dashboardId },
        data: {
          ...(parsedInput.name !== undefined && { name: parsedInput.name }),
          ...(parsedInput.description !== undefined && { description: parsedInput.description }),
        },
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

      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
      });

      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", parsedInput.dashboardId);
      }

      await prisma.dashboard.delete({
        where: { id: parsedInput.dashboardId },
      });

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

      return prisma.dashboard.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { widgets: true } },
        },
      });
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

      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
        include: {
          widgets: {
            orderBy: { order: "asc" },
            include: {
              chart: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  query: true,
                  config: true,
                },
              },
            },
          },
        },
      });

      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", parsedInput.dashboardId);
      }

      return dashboard;
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

      const [chart, dashboard] = await Promise.all([
        prisma.chart.findFirst({ where: { id: parsedInput.chartId, projectId } }),
        prisma.dashboard.findFirst({ where: { id: parsedInput.dashboardId, projectId } }),
      ]);

      if (!chart) {
        throw new ResourceNotFoundError("Chart", parsedInput.chartId);
      }
      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", parsedInput.dashboardId);
      }

      const widget = await prisma.$transaction(
        async (tx) => {
          const maxOrder = await tx.dashboardWidget.aggregate({
            where: { dashboardId: parsedInput.dashboardId },
            _max: { order: true },
          });

          return tx.dashboardWidget.create({
            data: {
              dashboardId: parsedInput.dashboardId,
              chartId: parsedInput.chartId,
              title: parsedInput.title,
              layout: parsedInput.layout,
              order: (maxOrder._max.order ?? -1) + 1,
            },
          });
        },
        { isolationLevel: "Serializable" }
      );

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.dashboardWidgetId = widget.id;
      ctx.auditLoggingCtx.newObject = widget;
      return widget;
    }
  )
);
