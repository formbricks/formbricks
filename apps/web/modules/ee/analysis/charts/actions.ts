"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/dashboard";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  createChart,
  deleteChart,
  duplicateChart,
  getChart,
  getCharts,
  updateChart,
} from "@/modules/ee/analysis/charts/lib/charts";
import { checkProjectAccess } from "@/modules/ee/analysis/lib/access";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ZChartType } from "../types/analysis";

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

      const chart = await createChart({
        projectId,
        name: parsedInput.name,
        type: parsedInput.type,
        query: parsedInput.query,
        config: parsedInput.config,
        createdBy: ctx.user.id,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.chartId = chart.id;
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

      const { chart, updatedChart } = await updateChart(parsedInput.chartId, projectId, {
        name: parsedInput.name,
        type: parsedInput.type,
        query: parsedInput.query,
        config: parsedInput.config,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
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

      const duplicatedChart = await duplicateChart(parsedInput.chartId, projectId, ctx.user.id);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.chartId = duplicatedChart.id;
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

      const chart = await deleteChart(parsedInput.chartId, projectId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.projectId = projectId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
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

      return getChart(parsedInput.chartId, projectId);
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

      return getCharts(projectId);
    }
  );
