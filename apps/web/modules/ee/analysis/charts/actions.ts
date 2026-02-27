"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type TChartQuery, ZChartQuery } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { validateQueryMembers } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  createChart,
  deleteChart,
  duplicateChart,
  getChart,
  getCharts,
  updateChart,
} from "@/modules/ee/analysis/charts/lib/charts";
import { checkProjectAccess } from "@/modules/ee/analysis/lib/access";
import { generateSchemaContext } from "@/modules/ee/analysis/lib/ai-schema-context";
import { ZChartCreateInput, ZChartType, ZChartUpdateInput } from "@/modules/ee/analysis/types/analysis";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

/** Client-facing chart input (projectId and createdBy are resolved server-side) */
const ZChartCreateInputClient = ZChartCreateInput.omit({ projectId: true, createdBy: true });

const ZCreateChartAction = z.object({
  environmentId: ZId,
  chartInput: ZChartCreateInputClient,
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
        ...parsedInput.chartInput,
        projectId,
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
  chartUpdateInput: ZChartUpdateInput,
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

      const { chart, updatedChart } = await updateChart(
        parsedInput.chartId,
        projectId,
        parsedInput.chartUpdateInput
      );

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
      await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      return getCharts(parsedInput.environmentId);
    }
  );

// ── Charts UI specific actions (query execution & AI generation) ─────────────

const ZExecuteQueryAction = z.object({
  environmentId: ZId,
  query: ZChartQuery,
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
      await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      validateQueryMembers(parsedInput.query);

      try {
        return await executeQuery(parsedInput.query as Record<string, unknown>);
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to execute query");
      }
    }
  );

const CUBE_NAME = "FeedbackRecords";

const ZGenerateAIQueryResponse = z.object({
  measures: z.array(z.string()),
  dimensions: z.array(z.string()).nullable(),
  timeDimensions: z
    .array(
      z.object({
        dimension: z.string(),
        granularity: z.enum(["hour", "day", "week", "month", "quarter", "year"]).nullable(),
        dateRange: z.string().nullable(),
      })
    )
    .nullable(),
  chartType: ZChartType,
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
        values: z.array(z.string()).nullable(),
      })
    )
    .nullable(),
});

const ZGenerateAIChartAction = z.object({
  environmentId: ZId,
  prompt: z.string().min(1).max(2000),
});

export const generateAIChartAction = authenticatedActionClient
  .schema(ZGenerateAIChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGenerateAIChartAction>;
    }) => {
      await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const schemaContext = generateSchemaContext();

      const { output } = await generateText({
        model: openai("gpt-4o-mini"),
        output: Output.object({ schema: ZGenerateAIQueryResponse }),
        system: schemaContext,
        prompt: `User request: "${parsedInput.prompt}"`,
      });

      const measures = output.measures.length > 0 ? output.measures : [`${CUBE_NAME}.count`];

      const { chartType, ...cubeQuery } = { ...output, measures };

      // Strip nulls/empty arrays so Cube.js receives only present fields
      const cleanQuery: Record<string, unknown> = {
        measures: cubeQuery.measures,
        ...(cubeQuery.dimensions?.length && { dimensions: cubeQuery.dimensions }),
        ...(cubeQuery.filters?.length && {
          filters: cubeQuery.filters.map(({ member, operator, values }) => ({
            member,
            operator,
            ...(values != null && { values }),
          })),
        }),
        ...(cubeQuery.timeDimensions?.length && {
          timeDimensions: cubeQuery.timeDimensions.map(({ dimension, granularity, dateRange }) => ({
            dimension,
            ...(granularity != null && { granularity }),
            ...(dateRange != null && { dateRange }),
          })),
        }),
      };

      validateQueryMembers(cleanQuery as TChartQuery);

      const data = await executeQuery(cleanQuery);

      return {
        query: cleanQuery,
        chartType,
        data: Array.isArray(data) ? data : [],
      };
    }
  );
