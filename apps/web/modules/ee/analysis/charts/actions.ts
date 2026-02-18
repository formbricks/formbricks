"use server";

import { ChartType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { executeQuery } from "@/app/api/analytics/_lib/cube-client";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZChartConfig, ZChartType, ZCubeQuery } from "../types/analysis";

const ZCreateChartAction = z.object({
  environmentId: ZId,
  name: z.string().min(1),
  type: ZChartType,
  query: ZCubeQuery,
  config: ZChartConfig.optional().default({}),
});

export const createChartAction = authenticatedActionClient.schema(ZCreateChartAction).action(
  withAuditLogging(
    "created",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateChartAction>;
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

const ZUpdateChartAction = z.object({
  environmentId: ZId,
  chartId: ZId,
  name: z.string().min(1).optional(),
  type: ZChartType.optional(),
  query: ZCubeQuery.optional(),
  config: ZChartConfig.optional(),
});

export const updateChartAction = authenticatedActionClient.schema(ZUpdateChartAction).action(
  withAuditLogging(
    "updated",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateChartAction>;
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

      const chart = await prisma.chart.findFirst({
        where: { id: parsedInput.chartId, projectId },
      });

      if (!chart) {
        throw new Error("Chart not found");
      }

      const updateData: {
        name?: string;
        type?: ChartType;
        query?: z.infer<typeof ZCubeQuery>;
        config?: z.infer<typeof ZChartConfig>;
      } = {};
      if (parsedInput.name !== undefined) updateData.name = parsedInput.name;
      if (parsedInput.type !== undefined) updateData.type = parsedInput.type as ChartType;
      if (parsedInput.query !== undefined) updateData.query = parsedInput.query;
      if (parsedInput.config !== undefined) updateData.config = parsedInput.config;

      const updatedChart = await prisma.chart.update({
        where: { id: parsedInput.chartId },
        data: updateData,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.oldObject = chart;
      ctx.auditLoggingCtx.newObject = updatedChart;
      return updatedChart;
    }
  )
);

const ZDuplicateChartAction = z.object({
  environmentId: ZId,
  chartId: ZId,
});

export const duplicateChartAction = authenticatedActionClient.schema(ZDuplicateChartAction).action(
  withAuditLogging(
    "created",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDuplicateChartAction>;
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

      const sourceChart = await prisma.chart.findFirst({
        where: { id: parsedInput.chartId, projectId },
      });

      if (!sourceChart) {
        throw new Error("Chart not found");
      }

      const duplicatedChart = await prisma.chart.create({
        data: {
          name: `${sourceChart.name} (copy)`,
          type: sourceChart.type,
          projectId,
          query: sourceChart.query as object,
          config: (sourceChart.config as object) || {},
          createdBy: ctx.user.id,
        },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.newObject = duplicatedChart;
      return duplicatedChart;
    }
  )
);

const ZDeleteChartAction = z.object({
  environmentId: ZId,
  chartId: ZId,
});

export const deleteChartAction = authenticatedActionClient.schema(ZDeleteChartAction).action(
  withAuditLogging(
    "deleted",
    "chart",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteChartAction>;
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

      const chart = await prisma.chart.findFirst({
        where: { id: parsedInput.chartId, projectId },
      });

      if (!chart) {
        throw new Error("Chart not found");
      }

      await prisma.dashboardWidget.deleteMany({
        where: { chartId: parsedInput.chartId },
      });

      await prisma.chart.delete({
        where: { id: parsedInput.chartId },
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.oldObject = chart;
      return { success: true };
    }
  )
);

const ZGetChartAction = z.object({
  environmentId: ZId,
  chartId: ZId,
});

export const getChartAction = authenticatedActionClient
  .schema(ZGetChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartAction>;
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
    }
  );

const ZGetChartsAction = z.object({
  environmentId: ZId,
});

export const getChartsAction = authenticatedActionClient
  .schema(ZGetChartsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartsAction>;
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
    }
  );

const ZExecuteQueryAction = z.object({
  environmentId: ZId,
  query: ZCubeQuery,
});

export const executeQueryAction = authenticatedActionClient
  .schema(ZExecuteQueryAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZExecuteQueryAction>;
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

      try {
        console.log("[executeQueryAction] Executing query:", JSON.stringify(parsedInput.query, null, 2));
        const data = await executeQuery(parsedInput.query as Record<string, unknown>);
        console.log(`[executeQueryAction] Success — ${Array.isArray(data) ? data.length : 0} row(s)`);
        return { data };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to execute query";
        console.error("[executeQueryAction] Failed:", {
          error: message,
          stack: error instanceof Error ? error.stack : undefined,
          query: parsedInput.query,
        });
        return { error: message };
      }
    }
  );
