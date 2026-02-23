"use server";

import OpenAI from "openai";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZChartQuery } from "@formbricks/types/dashboard";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
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
import { ZChartCreateInput, ZChartUpdateInput } from "@/modules/ee/analysis/types/analysis";
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
      const { projectId } = await checkProjectAccess(ctx.user.id, parsedInput.environmentId, "read");

      return getCharts(projectId);
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

      try {
        const data = await executeQuery(parsedInput.query as Record<string, unknown>);
        return { data };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to execute query";
        return { error: message };
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
  chartType: z.enum(["bar", "line", "donut", "kpi", "area", "pie"]),
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

const AI_QUERY_JSON_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    measures: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "List of measures to query",
    },
    dimensions: {
      anyOf: [{ type: "array" as const, items: { type: "string" as const } }, { type: "null" as const }],
      description: "List of dimensions to query",
    },
    timeDimensions: {
      anyOf: [
        {
          type: "array" as const,
          items: {
            type: "object" as const,
            additionalProperties: false,
            properties: {
              dimension: { type: "string" as const },
              granularity: {
                anyOf: [
                  {
                    type: "string" as const,
                    enum: ["hour", "day", "week", "month", "quarter", "year"],
                  },
                  { type: "null" as const },
                ],
              },
              dateRange: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
            },
            required: ["dimension", "granularity", "dateRange"],
          },
        },
        { type: "null" as const },
      ],
      description: "Time dimensions with granularity and date range",
    },
    chartType: {
      type: "string" as const,
      enum: ["bar", "line", "donut", "kpi", "area", "pie"],
      description: "Suggested chart type for visualization",
    },
    filters: {
      anyOf: [
        {
          type: "array" as const,
          items: {
            type: "object" as const,
            additionalProperties: false,
            properties: {
              member: { type: "string" as const },
              operator: {
                type: "string" as const,
                enum: [
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
                ],
              },
              values: {
                anyOf: [
                  { type: "array" as const, items: { type: "string" as const } },
                  { type: "null" as const },
                ],
              },
            },
            required: ["member", "operator", "values"],
          },
        },
        { type: "null" as const },
      ],
      description: "Filters to apply to the query",
    },
  },
  required: ["measures", "dimensions", "timeDimensions", "chartType", "filters"],
};

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

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const schemaContext = generateSchemaContext();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: schemaContext },
          { role: "user", content: `User request: "${parsedInput.prompt}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_cube_query",
              description: "Generate a Cube.js query based on the user request",
              parameters: AI_QUERY_JSON_SCHEMA,
              strict: true,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_cube_query" } },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.name !== "generate_cube_query") {
        throw new Error("Failed to generate structured output from OpenAI");
      }

      const rawQuery = JSON.parse(toolCall.function.arguments);
      const validated = ZGenerateAIQueryResponse.parse(rawQuery);

      if (!validated.measures || validated.measures.length === 0) {
        validated.measures = [`${CUBE_NAME}.count`];
      }

      const { chartType, ...cubeQuery } = validated;

      const cleanQuery: Record<string, unknown> = {
        measures: cubeQuery.measures,
      };

      if (Array.isArray(cubeQuery.dimensions) && cubeQuery.dimensions.length > 0) {
        cleanQuery.dimensions = cubeQuery.dimensions;
      }

      if (Array.isArray(cubeQuery.filters) && cubeQuery.filters.length > 0) {
        cleanQuery.filters = cubeQuery.filters.map(
          (f: { member: string; operator: string; values?: string[] | null }) => {
            const cleaned: Record<string, unknown> = { member: f.member, operator: f.operator };
            if (f.values !== null && f.values !== undefined) cleaned.values = f.values;
            return cleaned;
          }
        );
      }

      if (Array.isArray(cubeQuery.timeDimensions) && cubeQuery.timeDimensions.length > 0) {
        cleanQuery.timeDimensions = cubeQuery.timeDimensions.map(
          (td: { dimension: string; granularity?: string | null; dateRange?: string | null }) => {
            const cleaned: Record<string, unknown> = { dimension: td.dimension };
            if (td.granularity !== null && td.granularity !== undefined) cleaned.granularity = td.granularity;
            if (td.dateRange !== null && td.dateRange !== undefined) cleaned.dateRange = td.dateRange;
            return cleaned;
          }
        );
      }

      const data = await executeQuery(cleanQuery);

      return {
        query: cleanQuery,
        chartType,
        data: Array.isArray(data) ? data : [],
      };
    }
  );
