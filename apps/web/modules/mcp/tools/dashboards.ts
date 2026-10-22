import type { McpServer } from "@modelcontextprotocol/server";
import { previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { getV3ChartFieldCatalog } from "@/app/api/v3/charts/lib/field-operations";
import { getV3Chart, listV3Charts } from "@/app/api/v3/charts/lib/operations";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpChartIdInput,
  type TMcpListChartFieldsInput,
  type TMcpListChartsInput,
  type TMcpPreviewChartInput,
  ZMcpChartDataOutput,
  ZMcpChartFieldCatalogOutput,
  ZMcpChartIdInput,
  ZMcpChartListOutput,
  ZMcpChartOutput,
  ZMcpListChartFieldsInput,
  ZMcpListChartsInput,
  ZMcpPreviewChartInput,
} from "./dashboard-schemas";
import { registerScopedTool } from "./guard-scopes";
import { READ_ANNOTATIONS, toolContext } from "./tool-context";

/**
 * MCP tools over the v3 chart and dashboard operations — one tool per operation, so an agent can do
 * exactly what an API key can do over HTTP, minus deletion: there is no delete tool, so a vague prompt
 * like "clean up old charts" cannot remove anything permanently. There is no generate tool either; AI
 * chart generation is the app's, not the API's.
 *
 * Definitions and the field catalog need `dashboards:read`. Reading a chart's numbers also needs
 * `feedbackRecords:read`, so a dashboards grant never becomes a way into respondents' answers.
 */
export function registerDashboardTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_chart_fields",
    {
      title: "List chart fields",
      description: [
        "List the fields a chart query may use on a Feedback Dataset: each field's name, kind (measure, dimension, timeDimension), type, label, description, filter operators and granularities, plus the date presets.",
        "Call this before writing a chart query. Use the names exactly as listed, prefix included (FeedbackRecords.npsScore); a field not listed is refused.",
      ].join(" "),
      inputSchema: ZMcpListChartFieldsInput,
      outputSchema: ZMcpChartFieldCatalogOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async (input: TMcpListChartFieldsInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3ChartFieldCatalog({ ...input, ...context }),
        context.requestId
      );
    }
  );

  registerScopedTool(
    server,
    "list_charts",
    {
      title: "List charts",
      description:
        "List the charts in a Formbricks workspace, newest first, page by page. Each chart carries its chart query, display settings and the dashboards that hold it.",
      inputSchema: ZMcpListChartsInput,
      outputSchema: ZMcpChartListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async (input: TMcpListChartsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Charts({
        query: {
          workspaceId: input.workspaceId,
          limit: input.limit,
          cursor: input.cursor,
          "filter[name][contains]": input.nameContains,
          "filter[datasetId][eq]": input.datasetId,
        },
        ...context,
      });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_chart",
    {
      title: "Get chart",
      description:
        "Get one chart: its Feedback Dataset, type, chart query, display settings, and the dashboards that hold it. Check those before editing — an edit shows on every one of them.",
      inputSchema: ZMcpChartIdInput,
      outputSchema: ZMcpChartOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async (input: TMcpChartIdInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3Chart({ chartId: input.chartId, ...context }),
        context.requestId
      );
    }
  );

  registerScopedTool(
    server,
    "preview_chart",
    {
      title: "Preview chart",
      description:
        "Run an unsaved chart and return its rows, to check it shows what was meant before create_chart saves it. Saves nothing. The query is checked against the field catalog; a refused query names each problem.",
      inputSchema: ZMcpPreviewChartInput,
      outputSchema: ZMcpChartDataOutput,
      annotations: READ_ANNOTATIONS,
    },
    // The rows are respondents' answers in aggregate, so reading them also needs feedback-record access.
    ["dashboards:read", "feedbackRecords:read"],
    async (input: TMcpPreviewChartInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await previewV3Chart({ body: input, ...context }),
        context.requestId
      );
    }
  );
}
