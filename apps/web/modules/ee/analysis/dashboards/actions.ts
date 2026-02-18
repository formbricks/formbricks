"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZDashboardStatus, ZWidgetLayout } from "../types/analysis";

const ZAddChartToDashboardAction = z.object({
  environmentId: ZId,
  chartId: ZId,
  dashboardId: ZId,
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
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId,
          },
        ],
      });

      const [chart, dashboard] = await Promise.all([
        prisma.chart.findFirst({
          where: { id: parsedInput.chartId, projectId },
        }),
        prisma.dashboard.findFirst({
          where: { id: parsedInput.dashboardId, projectId },
        }),
      ]);

      if (!chart) {
        throw new Error("Chart not found");
      }
      if (!dashboard) {
        throw new Error("Dashboard not found");
      }

      const maxOrder = await prisma.dashboardWidget.aggregate({
        where: { dashboardId: parsedInput.dashboardId },
        _max: { order: true },
      });

      const widget = await prisma.dashboardWidget.create({
        data: {
          dashboardId: parsedInput.dashboardId,
          chartId: parsedInput.chartId,
          type: "chart",
          title: parsedInput.title,
          layout: parsedInput.layout,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.newObject = widget;
      return widget;
    }
  )
);

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
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId,
          },
        ],
      });

      const dashboard = await prisma.dashboard.create({
        data: {
          name: parsedInput.name,
          description: parsedInput.description,
          projectId,
          status: "draft",
          createdBy: ctx.user.id,
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
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
  status: ZDashboardStatus.optional(),
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
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId,
          },
        ],
      });

      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
      });

      if (!dashboard) {
        throw new Error("Dashboard not found");
      }

      const updatedDashboard = await prisma.dashboard.update({
        where: { id: parsedInput.dashboardId },
        data: {
          ...(parsedInput.name !== undefined && { name: parsedInput.name }),
          ...(parsedInput.description !== undefined && { description: parsedInput.description }),
          ...(parsedInput.status !== undefined && { status: parsedInput.status }),
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
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
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId,
          },
        ],
      });

      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
      });

      if (!dashboard) {
        throw new Error("Dashboard not found");
      }

      await prisma.dashboardWidget.deleteMany({
        where: { dashboardId: parsedInput.dashboardId },
      });

      await prisma.dashboard.delete({
        where: { id: parsedInput.dashboardId },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
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
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "read",
            projectId,
          },
        ],
      });

      const dashboards = await prisma.dashboard.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return dashboards;
    }
  );
