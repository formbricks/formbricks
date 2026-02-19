"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/dashboard";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZChartType } from "../types/analysis";

const checkProjectAccess = async (
  userId: string,
  environmentId: string,
  minPermission: "read" | "readWrite" | "manage"
) => {
  const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
  const projectId = await getProjectIdFromEnvironmentId(environmentId);

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      { type: "organization", roles: ["owner", "manager"] },
      { type: "projectTeam", minPermission, projectId },
    ],
  });

  return { organizationId, projectId };
};

const ZCreateChartAction = z.object({
  environmentId: ZId,
  name: z.string().min(1),
  type: ZChartType,
  query: ZChartQuery,
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const chart = await prisma.chart.create({
        data: {
          name: parsedInput.name,
          type: parsedInput.type,
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
  query: ZChartQuery.optional(),
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const chart = await prisma.chart.findFirst({
        where: { id: parsedInput.chartId, projectId },
      });

      if (!chart) {
        throw new Error("Chart not found");
      }

      const updatedChart = await prisma.chart.update({
        where: { id: parsedInput.chartId },
        data: {
          ...(parsedInput.name !== undefined && { name: parsedInput.name }),
          ...(parsedInput.type !== undefined && { type: parsedInput.type }),
          ...(parsedInput.query !== undefined && { query: parsedInput.query }),
          ...(parsedInput.config !== undefined && { config: parsedInput.config }),
        },
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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

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
      const { organizationId, projectId } = await checkProjectAccess(
        ctx.user.id,
        parsedInput.environmentId,
        "readWrite"
      );

      const chart = await prisma.chart.findFirst({
        where: { id: parsedInput.chartId, projectId },
      });

      if (!chart) {
        throw new Error("Chart not found");
      }

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
      const { projectId } = await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

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
      const { projectId } = await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      return prisma.chart.findMany({
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
            select: { dashboardId: true },
          },
        },
      });
    }
  );
