import type { McpServer } from "@modelcontextprotocol/server";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "@/app/api/v3/charts/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import type { TMcpToolContext } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpChartIdInput,
  type TMcpCreateChartInput,
  type TMcpGetChartDataInput,
  type TMcpListChartFieldValuesInput,
  type TMcpListChartFieldsInput,
  type TMcpListChartsInput,
  type TMcpPreviewChartInput,
  type TMcpUpdateChartInput,
  ZMcpChartDataOutput,
  ZMcpChartFieldCatalogOutput,
  ZMcpChartFieldValuesOutput,
  ZMcpChartIdInput,
  ZMcpChartListOutput,
  ZMcpChartOutput,
  ZMcpCreateChartInput,
  ZMcpGetChartDataInput,
  ZMcpListChartFieldValuesInput,
  ZMcpListChartFieldsInput,
  ZMcpListChartsInput,
  ZMcpPreviewChartInput,
  ZMcpUpdateChartInput,
} from "./dashboard-schemas";
import { registerScopedTool } from "./guard-scopes";
import { runMcpMutation } from "./run-mcp-mutation";
import { READ_ANNOTATIONS, WRITE_ANNOTATIONS, toolContext } from "./tool-context";

type TMutationRun = Parameters<Parameters<typeof runMcpMutation>[2]>[0];

/**
 * A chart or dashboard write with the audit lifecycle the v3 route wrapper provides, so a write through
 * MCP leaves the same audit event as the same write over HTTP.
 */
const runMutation = (
  ctx: TMcpToolContext,
  action: "created" | "updated" | "deleted",
  resource: "chart" | "dashboard" | "dashboardWidget",
  run: (context: {
    authentication: TMutationRun["authentication"];
    auditLog: NonNullable<TMutationRun["auditLog"]> | undefined;
    requestId: string;
    instance: string;
  }) => Promise<Response>
) =>
  runMcpMutation(ctx, { action, resource }, ({ authentication, requestId, auditLog }) =>
    run({ authentication, auditLog: auditLog ?? undefined, requestId, instance: MCP_API_ROUTE })
  );

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

  registerScopedTool(
    server,
    "create_chart",
    {
      title: "Create chart",
      description:
        "Create a chart on a Feedback Dataset: a name, a type, a chart query and optional display settings. Write the query with list_chart_fields and check it with preview_chart first. The Feedback Dataset is fixed once the chart exists.",
      inputSchema: ZMcpCreateChartInput,
      outputSchema: ZMcpChartOutput,
      audit: { action: "created", targetType: "chart" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async (input: TMcpCreateChartInput, ctx) =>
      runMutation(ctx, "created", "chart", (context) => createV3Chart({ body: input, ...context }))
  );

  registerScopedTool(
    server,
    "update_chart",
    {
      title: "Update chart",
      description:
        "Edit a chart's name, type, chart query or display settings. The chart may sit on several dashboards, and the edit shows on every one of them — get_chart lists them. To change it for one dashboard only, duplicate_chart and repoint that dashboard's widget instead. The Feedback Dataset cannot change.",
      inputSchema: ZMcpUpdateChartInput,
      outputSchema: ZMcpChartOutput,
      audit: { action: "updated", targetType: "chart", targetIdArg: "chartId" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ chartId, ...body }: TMcpUpdateChartInput, ctx) =>
      runMutation(ctx, "updated", "chart", (context) => updateV3Chart({ chartId, body, ...context }))
  );

  registerScopedTool(
    server,
    "get_chart_data",
    {
      title: "Get chart data",
      description:
        "Read a saved chart's rows. A dateRange (a preset, 'all-time', or { from, to }) replaces the chart's own range on collectedAt, so the numbers match a dashboard filtered the same way; without one the chart's saved range applies. Ranges are read in the organization's time zone.",
      inputSchema: ZMcpGetChartDataInput,
      outputSchema: ZMcpChartDataOutput,
      annotations: READ_ANNOTATIONS,
    },
    // The rows are respondents' answers in aggregate, so reading them also needs feedback-record access.
    ["dashboards:read", "feedbackRecords:read"],
    async ({ chartId, dateRange }: TMcpGetChartDataInput, ctx) => {
      const context = toolContext(ctx);
      const query = typeof dateRange === "string" ? { dateRange } : (dateRange ?? {});
      return await responseToMcpToolResult(
        await getV3ChartData({ chartId, query, ...context }),
        context.requestId
      );
    }
  );

  registerScopedTool(
    server,
    "list_chart_field_values",
    {
      title: "List chart field values",
      description:
        "List up to 100 distinct stored values of a field marked valueLookup in list_chart_fields, optionally narrowed by a search term, so a filter uses a value that really occurs.",
      inputSchema: ZMcpListChartFieldValuesInput,
      outputSchema: ZMcpChartFieldValuesOutput,
      annotations: READ_ANNOTATIONS,
    },
    // The values are what respondents answered, so looking them up also needs feedback-record access.
    ["dashboards:read", "feedbackRecords:read"],
    async ({ field, ...query }: TMcpListChartFieldValuesInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await listV3ChartFieldValues({ field, query, ...context }),
        context.requestId
      );
    }
  );
}
