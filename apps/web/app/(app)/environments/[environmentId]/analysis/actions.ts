"use server";

import { ChartType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { executeQuery } from "@/app/api/analytics/_lib/cube-client";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateChartAction = z.object({
  environmentId: ZId,
  name: z.string().min(1),
  type: z.enum(["area", "bar", "line", "pie", "big_number", "big_number_total", "table", "funnel", "map"]),
  query: z.record(z.any()),
  config: z.record(z.any()).optional().default({}),
});

export const createChartAction = authenticatedActionClient.schema(ZCreateChartAction).action(
  withAuditLogging(
    "created",
    "chart",
    async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZCreateChartAction> }) => {
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

      const chart = await prisma.chart.create({
        data: {
          name: parsedInput.name,
          type: parsedInput.type as ChartType,
          projectId,
          query: parsedInput.query,
          config: parsedInput.config || {},
          createdBy: ctx.user.id,
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.newObject = chart;
      return chart;
    }
  )
);

const ZAddChartToDashboardAction = z.object({
  environmentId: ZId,
  chartId: ZId,
  dashboardId: ZId,
  title: z.string().optional(),
  layout: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional()
    .default({ x: 0, y: 0, w: 4, h: 3 }),
});

export const addChartToDashboardAction = authenticatedActionClient.schema(ZAddChartToDashboardAction).action(
  withAuditLogging(
    "created",
    "dashboardWidget",
    async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZAddChartToDashboardAction> }) => {
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

      // Verify chart and dashboard belong to the same project
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

      // Get the max order for widgets in this dashboard
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
    async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZCreateDashboardAction> }) => {
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
  status: z.enum(["draft", "published"]).optional(),
});

export const updateDashboardAction = authenticatedActionClient.schema(ZUpdateDashboardAction).action(
  withAuditLogging(
    "updated",
    "dashboard",
    async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZUpdateDashboardAction> }) => {
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

      // Verify dashboard belongs to the project
      const dashboard = await prisma.dashboard.findFirst({
        where: { id: parsedInput.dashboardId, projectId },
      });

      if (!dashboard) {
        throw new Error("Dashboard not found");
      }

      const updateData: any = {};
      if (parsedInput.name !== undefined) updateData.name = parsedInput.name;
      if (parsedInput.description !== undefined) updateData.description = parsedInput.description;
      if (parsedInput.status !== undefined) updateData.status = parsedInput.status;

      const updatedDashboard = await prisma.dashboard.update({
        where: { id: parsedInput.dashboardId },
        data: updateData,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.oldObject = dashboard;
      ctx.auditLoggingCtx.newObject = updatedDashboard;
      return updatedDashboard;
    }
  )
);

const ZGetDashboardsAction = z.object({
  environmentId: ZId,
});

export const getDashboardsAction = authenticatedActionClient
  .schema(ZGetDashboardsAction)
  .action(async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZGetDashboardsAction> }) => {
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
  });

const ZGetChartAction = z.object({
  environmentId: ZId,
  chartId: ZId,
});

export const getChartAction = authenticatedActionClient
  .schema(ZGetChartAction)
  .action(async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZGetChartAction> }) => {
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

    const chart = await prisma.chart.findFirst({
      where: { id: parsedInput.chartId, projectId },
      select: {
        id: true,
        name: true,
        type: true,
        query: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!chart) {
      throw new Error("Chart not found");
    }

    return chart;
  });

const ZGetChartsAction = z.object({
  environmentId: ZId,
});

export const getChartsAction = authenticatedActionClient
  .schema(ZGetChartsAction)
  .action(async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZGetChartsAction> }) => {
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

    const charts = await prisma.chart.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        query: true,
        config: true,
        widgets: {
          select: {
            dashboardId: true,
          },
        },
      },
    });

    return charts;
  });

const ZExecuteQueryAction = z.object({
  environmentId: ZId,
  query: z.object({
    measures: z.array(z.string()),
    dimensions: z.array(z.string()).optional(),
    timeDimensions: z
      .array(
        z.object({
          dimension: z.string(),
          granularity: z.enum(["hour", "day", "week", "month", "quarter", "year"]).optional(),
          dateRange: z.union([z.string(), z.array(z.string())]).optional(),
        })
      )
      .optional(),
    filters: z
      .array(
        z.object({
          member: z.string(),
          operator: z.enum([
            "equals",
            "notEquals",
            "contains",
            "notContains",
            "set",
            "notSet",
            "gt",
            "gte",
            "lt",
            "lte",
          ]),
          values: z.array(z.string()).optional().nullable(),
        })
      )
      .optional(),
  }),
});

export const executeQueryAction = authenticatedActionClient
  .schema(ZExecuteQueryAction)
  .action(async ({ ctx, parsedInput }: { ctx: any; parsedInput: z.infer<typeof ZExecuteQueryAction> }) => {
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

    try {
      const data = await executeQuery(parsedInput.query);
      return { data };
    } catch (error: any) {
      return { error: error.message || "Failed to execute query" };
    }
  });
