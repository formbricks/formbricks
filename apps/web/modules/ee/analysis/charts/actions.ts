"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type TChartQuery, ZChartQuery } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { injectTenantFilter, validateQueryMembers } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  createChart,
  deleteChart,
  duplicateChart,
  getChart,
  getCharts,
  updateChart,
} from "@/modules/ee/analysis/charts/lib/charts";
import { checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import { generateSchemaContext } from "@/modules/ee/analysis/lib/ai-schema-context";
import { ZChartCreateInput, ZChartType, ZChartUpdateInput } from "@/modules/ee/analysis/types/analysis";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

/** Client-facing chart input (workspaceId and createdBy are resolved server-side) */
const ZChartCreateInputClient = ZChartCreateInput.omit({ workspaceId: true, createdBy: true });

const ZCreateChartAction = z.object({
  workspaceId: ZId,
  chartInput: ZChartCreateInputClient,
});

export const createChartAction = authenticatedActionClient.inputSchema(ZCreateChartAction).action(
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
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );

      const chart = await createChart({
        ...parsedInput.chartInput,
        workspaceId,
        createdBy: ctx.user.id,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = chart.id;
      ctx.auditLoggingCtx.newObject = chart;
      return chart;
    }
  )
);

const ZUpdateChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
  chartUpdateInput: ZChartUpdateInput,
});

export const updateChartAction = authenticatedActionClient.inputSchema(ZUpdateChartAction).action(
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
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );

      const { chart, updatedChart } = await updateChart(
        parsedInput.chartId,
        workspaceId,
        parsedInput.chartUpdateInput
      );

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
      ctx.auditLoggingCtx.oldObject = chart;
      ctx.auditLoggingCtx.newObject = updatedChart;
      return updatedChart;
    }
  )
);

const ZDuplicateChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const duplicateChartAction = authenticatedActionClient.inputSchema(ZDuplicateChartAction).action(
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
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );

      const duplicatedChart = await duplicateChart(parsedInput.chartId, workspaceId, ctx.user.id);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = duplicatedChart.id;
      ctx.auditLoggingCtx.newObject = duplicatedChart;
      return duplicatedChart;
    }
  )
);

const ZDeleteChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const deleteChartAction = authenticatedActionClient.inputSchema(ZDeleteChartAction).action(
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
      const { organizationId, workspaceId } = await checkWorkspaceAccess(
        ctx.user.id,
        parsedInput.workspaceId,
        "readWrite"
      );

      const chart = await deleteChart(parsedInput.chartId, workspaceId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = workspaceId;
      ctx.auditLoggingCtx.chartId = parsedInput.chartId;
      ctx.auditLoggingCtx.oldObject = chart;
      return { success: true };
    }
  )
);

const ZGetChartAction = z.object({
  workspaceId: ZId,
  chartId: ZId,
});

export const getChartAction = authenticatedActionClient
  .inputSchema(ZGetChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartAction>;
    }) => {
      const { workspaceId } = await checkWorkspaceAccess(ctx.user.id, parsedInput.workspaceId, "read");

      return getChart(parsedInput.chartId, workspaceId);
    }
  );

const ZGetChartsAction = z.object({
  workspaceId: ZId,
});

export const getChartsAction = authenticatedActionClient
  .inputSchema(ZGetChartsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetChartsAction>;
    }) => {
      const { workspaceId } = await checkWorkspaceAccess(ctx.user.id, parsedInput.workspaceId, "read");
      const charts = await getCharts(workspaceId);
      return charts;
    }
  );

// ── Charts UI specific actions (query execution & AI generation) ─────────────

const ZExecuteQueryAction = z.object({
  workspaceId: ZId,
  query: ZChartQuery,
  feedbackRecordDirectoryId: ZId,
});

export const executeQueryAction = authenticatedActionClient
  .inputSchema(ZExecuteQueryAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZExecuteQueryAction>;
    }) => {
      await checkWorkspaceAccess(ctx.user.id, parsedInput.workspaceId, "read");

      validateQueryMembers(parsedInput.query);

      const scopedQuery = injectTenantFilter(parsedInput.query, parsedInput.feedbackRecordDirectoryId);

      try {
        return await executeQuery(scopedQuery as Record<string, unknown>);
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
  workspaceId: ZId,
  prompt: z.string().min(1).max(2000),
  feedbackRecordDirectoryId: ZId,
});

export const generateAIChartAction = authenticatedActionClient
  .inputSchema(ZGenerateAIChartAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGenerateAIChartAction>;
    }) => {
      await checkWorkspaceAccess(ctx.user.id, parsedInput.workspaceId, "read");

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

      const scopedQuery = injectTenantFilter(
        cleanQuery as TChartQuery,
        parsedInput.feedbackRecordDirectoryId
      );

      const data = await executeQuery(scopedQuery as Record<string, unknown>);

      return {
        query: cleanQuery,
        chartType,
        data: Array.isArray(data) ? data : [],
      };
    }
  );
