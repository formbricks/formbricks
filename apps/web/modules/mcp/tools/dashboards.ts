import type { McpServer } from "@modelcontextprotocol/server";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "@/app/api/v3/charts/lib/operations";
import {
  createV3Dashboard,
  duplicateV3Dashboard,
  getV3Dashboard,
  listV3Dashboards,
  renameV3Dashboard,
} from "@/app/api/v3/dashboards/lib/operations";
import {
  addV3DashboardWidget,
  removeV3DashboardWidget,
  updateV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/widget-operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import type { TMcpToolContext } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpAddChartToDashboardInput,
  type TMcpChartIdInput,
  type TMcpCreateChartInput,
  type TMcpCreateDashboardInput,
  type TMcpDashboardIdInput,
  type TMcpDuplicateDashboardInput,
  type TMcpGetChartDataInput,
  type TMcpListChartFieldValuesInput,
  type TMcpListChartFieldsInput,
  type TMcpListChartsInput,
  type TMcpListDashboardsInput,
  type TMcpPreviewChartInput,
  type TMcpRemoveChartFromDashboardInput,
  type TMcpUpdateChartInput,
  type TMcpUpdateDashboardInput,
  type TMcpUpdateWidgetInput,
  ZMcpAddChartToDashboardInput,
  ZMcpChartDataOutput,
  ZMcpChartFieldCatalogOutput,
  ZMcpChartFieldValuesOutput,
  ZMcpChartIdInput,
  ZMcpChartListOutput,
  ZMcpChartOutput,
  ZMcpCreateChartInput,
  ZMcpCreateDashboardInput,
  ZMcpDashboardIdInput,
  ZMcpDashboardListOutput,
  ZMcpDashboardOutput,
  ZMcpDuplicateDashboardInput,
  ZMcpGetChartDataInput,
  ZMcpListChartFieldValuesInput,
  ZMcpListChartFieldsInput,
  ZMcpListChartsInput,
  ZMcpListDashboardsInput,
  ZMcpPreviewChartInput,
  ZMcpRemoveChartFromDashboardInput,
  ZMcpUpdateChartInput,
  ZMcpUpdateDashboardInput,
  ZMcpUpdateWidgetInput,
  ZMcpWidgetOutput,
} from "./dashboard-schemas";
import { registerScopedTool } from "./guard-scopes";
import { ZMcpAcknowledgement } from "./output-schemas";
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

  registerScopedTool(
    server,
    "list_dashboards",
    {
      title: "List dashboards",
      description:
        "List the dashboards in a Formbricks workspace, newest first, page by page, each with its widget count. Pass chartId to find the dashboards that hold a chart.",
      inputSchema: ZMcpListDashboardsInput,
      outputSchema: ZMcpDashboardListOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async (input: TMcpListDashboardsInput, ctx) => {
      const context = toolContext(ctx);
      const response = await listV3Dashboards({
        query: {
          workspaceId: input.workspaceId,
          limit: input.limit,
          cursor: input.cursor,
          "filter[name][contains]": input.nameContains,
          "filter[chartId][eq]": input.chartId,
        },
        ...context,
      });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerScopedTool(
    server,
    "get_dashboard",
    {
      title: "Get dashboard",
      description:
        "Get one dashboard with every widget: its position and size on the 12-column grid, its order, and its full chart. Read each chart's numbers with get_chart_data.",
      inputSchema: ZMcpDashboardIdInput,
      outputSchema: ZMcpDashboardOutput,
      annotations: READ_ANNOTATIONS,
    },
    ["dashboards:read"],
    async ({ dashboardId }: TMcpDashboardIdInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3Dashboard({ dashboardId, ...context }),
        context.requestId
      );
    }
  );

  registerScopedTool(
    server,
    "create_dashboard",
    {
      title: "Create dashboard",
      description:
        "Create an empty dashboard in a workspace. Put charts on it with add_chart_to_dashboard; a chart can sit on several dashboards at once.",
      inputSchema: ZMcpCreateDashboardInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "created", targetType: "dashboard" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async (input: TMcpCreateDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboard", (context) => createV3Dashboard({ body: input, ...context }))
  );

  registerScopedTool(
    server,
    "update_dashboard",
    {
      title: "Rename dashboard",
      description:
        "Rename a dashboard. Only the name changes; move, resize or remove its widgets with update_widget and remove_chart_from_dashboard.",
      inputSchema: ZMcpUpdateDashboardInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "updated", targetType: "dashboard", targetIdArg: "dashboardId" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ dashboardId, ...body }: TMcpUpdateDashboardInput, ctx) =>
      runMutation(ctx, "updated", "dashboard", (context) =>
        renameV3Dashboard({ dashboardId, body, ...context })
      )
  );

  registerScopedTool(
    server,
    "duplicate_dashboard",
    {
      title: "Duplicate dashboard",
      description:
        "Copy a dashboard with its layout. The copy shares the original's charts — it does not copy them — so editing one of those charts with update_chart changes both dashboards. To change a chart on the copy only, duplicate_chart and repoint the copy's widget with update_widget.",
      inputSchema: ZMcpDuplicateDashboardInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "created", targetType: "dashboard" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ dashboardId, ...body }: TMcpDuplicateDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboard", (context) =>
        duplicateV3Dashboard({ dashboardId, body, ...context })
      )
  );

  registerScopedTool(
    server,
    "add_chart_to_dashboard",
    {
      title: "Add chart to dashboard",
      description:
        "Put an existing chart on a dashboard. Without a layout it lands in the first open slot at its type's default size; with one, exactly there, provided no other widget is. A chart appears at most once per dashboard, and the same chart can sit on several dashboards.",
      inputSchema: ZMcpAddChartToDashboardInput,
      outputSchema: ZMcpWidgetOutput,
      audit: { action: "created", targetType: "dashboardWidget" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ dashboardId, ...body }: TMcpAddChartToDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboardWidget", (context) =>
        addV3DashboardWidget({ dashboardId, body, ...context })
      )
  );

  registerScopedTool(
    server,
    "update_widget",
    {
      title: "Update widget",
      description:
        "Move or resize a widget, or show another chart in its place, or both. Repointing is how one dashboard gets its own version of a shared chart: duplicate_chart, then point this widget at the copy.",
      inputSchema: ZMcpUpdateWidgetInput,
      outputSchema: ZMcpWidgetOutput,
      audit: { action: "updated", targetType: "dashboardWidget", targetIdArg: "widgetId" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ dashboardId, widgetId, ...body }: TMcpUpdateWidgetInput, ctx) =>
      runMutation(ctx, "updated", "dashboardWidget", (context) =>
        updateV3DashboardWidget({ dashboardId, widgetId, body, ...context })
      )
  );

  registerScopedTool(
    server,
    "remove_chart_from_dashboard",
    {
      title: "Remove chart from dashboard",
      description:
        "Take a chart off a dashboard by removing its widget. The chart itself is kept, with every other dashboard it sits on; add it back with add_chart_to_dashboard.",
      inputSchema: ZMcpRemoveChartFromDashboardInput,
      outputSchema: ZMcpAcknowledgement,
      audit: { action: "deleted", targetType: "dashboardWidget", targetIdArg: "widgetId" },
      annotations: WRITE_ANNOTATIONS,
    },
    ["dashboards:write"],
    async ({ dashboardId, widgetId }: TMcpRemoveChartFromDashboardInput, ctx) =>
      runMutation(ctx, "deleted", "dashboardWidget", (context) =>
        removeV3DashboardWidget({ dashboardId, widgetId, ...context })
      )
  );
}
