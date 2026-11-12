import type { McpServer } from "@modelcontextprotocol/server";
import { createId } from "@paralleldrive/cuid2";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { duplicateV3Chart } from "@/app/api/v3/charts/lib/duplicate-operations";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "@/app/api/v3/charts/lib/operations";
import { getV3DashboardChartData } from "@/app/api/v3/dashboards/lib/chart-data-operations";
import { listV3DashboardFilterFields } from "@/app/api/v3/dashboards/lib/filter-fields-operations";
import { listV3DashboardFilterValues } from "@/app/api/v3/dashboards/lib/filter-values-operations";
import {
  createV3Dashboard,
  duplicateV3Dashboard,
  getV3Dashboard,
  listV3Dashboards,
  renameV3Dashboard,
  setV3DashboardFilters,
  updateV3DashboardLayout,
} from "@/app/api/v3/dashboards/lib/operations";
import {
  addV3DashboardWidget,
  removeV3DashboardWidget,
  updateV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/widget-operations";
import { toRequestFilters } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, isMcpDashboardViewerOnly } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpAddChartToDashboardInput,
  type TMcpChartIdInput,
  type TMcpCreateChartInput,
  type TMcpCreateDashboardInput,
  type TMcpDashboardIdInput,
  type TMcpDuplicateChartInput,
  type TMcpDuplicateDashboardInput,
  type TMcpGetChartDataInput,
  type TMcpListChartFieldValuesInput,
  type TMcpListChartFieldsInput,
  type TMcpListChartsInput,
  type TMcpListDashboardFilterValuesInput,
  type TMcpListDashboardsInput,
  type TMcpPreviewChartInput,
  type TMcpRemoveChartFromDashboardInput,
  type TMcpSetDashboardFiltersInput,
  type TMcpUpdateChartInput,
  type TMcpUpdateDashboardInput,
  type TMcpUpdateDashboardLayoutInput,
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
  ZMcpDashboardFilterFieldsOutput,
  ZMcpDashboardFilterValuesOutput,
  ZMcpDashboardIdInput,
  ZMcpDashboardListOutput,
  ZMcpDashboardOutput,
  ZMcpDuplicateChartInput,
  ZMcpDuplicateDashboardInput,
  ZMcpGetChartDataInput,
  ZMcpGetChartDataOutput,
  ZMcpListChartFieldValuesInput,
  ZMcpListChartFieldsInput,
  ZMcpListChartsInput,
  ZMcpListDashboardFilterValuesInput,
  ZMcpListDashboardsInput,
  ZMcpPreviewChartInput,
  ZMcpRemoveChartFromDashboardInput,
  ZMcpSetDashboardFiltersInput,
  ZMcpUpdateChartInput,
  ZMcpUpdateDashboardInput,
  ZMcpUpdateDashboardLayoutInput,
  ZMcpUpdateWidgetInput,
  ZMcpWidgetOutput,
} from "./dashboard-schemas";
import { registerMcpTool } from "./guard-permissions";
import { ZMcpAcknowledgement } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  DESTRUCTIVE_WRITE_ANNOTATIONS,
  READ_ANNOTATIONS,
  WRITE_ANNOTATIONS,
  toolContext,
} from "./tool-context";

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
 * Chart reads declare Charts and Feedback records, both at Read, so a dashboards grant never becomes a
 * way into respondents' answers. Dashboard reads declare Dashboards. The one exception is a Dashboard viewer's token reading a
 * chart through its dashboard (ADR-0025): that token is trimmed to `dashboards:read`, so the read declares
 * Dashboards alone, and the dashboard is exactly what the role may see.
 */
const hasDashboardId = (input: unknown): boolean =>
  typeof input === "object" &&
  input !== null &&
  typeof (input as { dashboardId?: unknown }).dashboardId === "string";

export function registerDashboardTools(server: McpServer): void {
  registerMcpTool(
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
    // Chart definitions and the field catalog are chart-building surfaces, not dashboard reading: they
    // need feedback-record access, like preview_chart. A Dashboard viewer's token is trimmed to
    // `dashboards:read` (ADR-0025) and its operation would 403, so the scope gate refuses it first.
    [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ],
    async (input: TMcpListChartFieldsInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3ChartFieldCatalog({ ...input, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    // Chart definitions and the field catalog are chart-building surfaces, not dashboard reading: they
    // need feedback-record access, like preview_chart. A Dashboard viewer's token is trimmed to
    // `dashboards:read` (ADR-0025) and its operation would 403, so the scope gate refuses it first.
    [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ],
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

  registerMcpTool(
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
    // Chart definitions and the field catalog are chart-building surfaces, not dashboard reading: they
    // need feedback-record access, like preview_chart. A Dashboard viewer's token is trimmed to
    // `dashboards:read` (ADR-0025) and its operation would 403, so the scope gate refuses it first.
    [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ],
    async (input: TMcpChartIdInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3Chart({ chartId: input.chartId, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ],
    async (input: TMcpPreviewChartInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await previewV3Chart({ body: input, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    [{ permission: "charts", level: "write" }],
    async (input: TMcpCreateChartInput, ctx) =>
      runMutation(ctx, "created", "chart", (context) => createV3Chart({ body: input, ...context }))
  );

  registerMcpTool(
    server,
    "update_chart",
    {
      title: "Update chart",
      description:
        "Edit a chart's name, type, chart query or display settings. The chart may sit on several dashboards, and the edit shows on every one of them — get_chart lists them. To change it for one dashboard only, duplicate_chart and repoint that dashboard's widget instead. The Feedback Dataset cannot change.",
      inputSchema: ZMcpUpdateChartInput,
      outputSchema: ZMcpChartOutput,
      audit: { action: "updated", targetType: "chart", targetIdArg: "chartId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "charts", level: "write" }],
    async ({ chartId, ...body }: TMcpUpdateChartInput, ctx) =>
      runMutation(ctx, "updated", "chart", (context) => updateV3Chart({ chartId, body, ...context }))
  );

  registerMcpTool(
    server,
    "get_chart_data",
    {
      title: "Get chart data",
      description:
        "Read a saved chart's rows. A dateRange (a preset, 'all-time', or { from, to }) replaces the chart's own range on collectedAt; without one the chart's saved range applies. Pass dashboardId to read the chart through a dashboard it sits on, as the dashboard shows it: filters (a field, an operator and values each, on any dimension of the chart's dataset or an embedded-data field) are then ANDed onto the chart's saved filters and never widen it, and a filter on a field the chart's Feedback Dataset lacks returns no rows and names the filter in unfilterableFilters, as does a filter on Sentiment, Sentiment Score or Emotions that needs a value, on a chart that reads no text answer (its saved filters pin fieldType to non-text types, or every measure is an NPS, CSAT, CES or rating one). Without dashboardId filters are not accepted. Ranges are read in the organization's time zone. For a chart grouped by time alone, a range wider than 10,000 buckets of its granularity (about 13 months by the hour) is refused with limit_exceeded.",
      inputSchema: ZMcpGetChartDataInput,
      outputSchema: ZMcpGetChartDataOutput,
      annotations: READ_ANNOTATIONS,
    },
    // The rows are respondents' answers in aggregate, so reading them needs feedback-record access too.
    // The one exception is a Dashboard viewer reading through a dashboard (ADR-0025): its token is
    // trimmed to `dashboards:read`, and the dashboard is the only data it may see (S1).
    {
      byInput: (input, authInfo) =>
        hasDashboardId(input) && isMcpDashboardViewerOnly(authInfo)
          ? [{ permission: "dashboards", level: "read" }]
          : [
              { permission: "charts", level: "read" },
              { permission: "feedbackRecords", level: "read" },
            ],
    },
    async ({ dashboardId, chartId, dateRange, filters }: TMcpGetChartDataInput, ctx) => {
      const context = toolContext(ctx);
      const range = typeof dateRange === "string" ? { dateRange } : (dateRange ?? {});
      const response = dashboardId
        ? await getV3DashboardChartData({
            dashboardId,
            chartId,
            query: { ...range, ...toRequestFilters(filters ?? []) },
            ...context,
          })
        : await getV3ChartData({ chartId, query: range, ...context });
      return await responseToMcpToolResult(response, context.requestId);
    }
  );

  registerMcpTool(
    server,
    "list_dashboard_filter_fields",
    {
      title: "List dashboard filter fields",
      description:
        "List the embedded-data fields a dashboard can be filtered on: the keys of the Feedback Datasets its charts read, each once, in key order, with the name a filter uses (FeedbackRecords.ed_…), its label and its type on this dashboard: number when every Embedded Data field it holds is a number field, which a filter may then compare with gt, gte, lt and lte; string otherwise. Use a name as the field of a filter in set_dashboard_filters, in get_chart_data with dashboardId, and in list_dashboard_filter_values. A Dashboard viewer, who cannot call list_chart_fields, finds a dashboard's embedded-data fields here, and gets only the keys some chart on the dashboard groups by.",
      inputSchema: ZMcpDashboardIdInput,
      outputSchema: ZMcpDashboardFilterFieldsOutput,
      annotations: READ_ANNOTATIONS,
    },
    // Like list_dashboard_filter_values: anyone but a Dashboard viewer also needs feedback-record access,
    // as list_chart_fields does for the same keys; a viewer's token holds dashboards:read alone (ADR-0025).
    {
      byInput: (_input, authInfo) =>
        isMcpDashboardViewerOnly(authInfo)
          ? [{ permission: "dashboards", level: "read" }]
          : [
              { permission: "dashboards", level: "read" },
              { permission: "feedbackRecords", level: "read" },
            ],
    },
    async ({ dashboardId }: TMcpDashboardIdInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await listV3DashboardFilterFields({ dashboardId, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
    server,
    "list_dashboard_filter_values",
    {
      title: "List dashboard filter values",
      description:
        "List up to 100 values a field offers for a dashboard, alphabetically, with hasMore when more match: the values the dashboard's charts show under their saved filters, narrowed by the dateRange, the filters already applied and search. Only a categorical field (one marked valueLookup in list_chart_fields, or FeedbackRecords.valueId), a yes/no field or an embedded-data field, with equals or notEquals, has a list; others take a typed value. The list holds only values that occur, so a fixed-option field (sentiment, value band, yes/no) shows which of its options the charts have. A value stored as an id a survey names (an answer's option, a source id, an ending) carries the label it is shown by; search matches the label too. Pass the values, not the labels, as a filter to get_chart_data.",
      inputSchema: ZMcpListDashboardFilterValuesInput,
      outputSchema: ZMcpDashboardFilterValuesOutput,
      annotations: READ_ANNOTATIONS,
    },
    // Like a chart read through its dashboard: the values are respondents' answers, so anyone but a
    // Dashboard viewer also needs feedback-record access; a viewer's token holds dashboards:read alone.
    {
      byInput: (_input, authInfo) =>
        isMcpDashboardViewerOnly(authInfo)
          ? [{ permission: "dashboards", level: "read" }]
          : [
              { permission: "dashboards", level: "read" },
              { permission: "feedbackRecords", level: "read" },
            ],
    },
    async (
      { dashboardId, field, operator, dateRange, filters, search }: TMcpListDashboardFilterValuesInput,
      ctx
    ) => {
      const context = toolContext(ctx);
      const range = typeof dateRange === "string" ? { dateRange } : (dateRange ?? {});
      // The filter listed is `f1`; the ones already applied follow it.
      return await responseToMcpToolResult(
        await listV3DashboardFilterValues({
          dashboardId,
          filterId: "f1",
          query: {
            ...range,
            ...toRequestFilters([{ field, operator: operator ?? "equals" }, ...(filters ?? [])]),
            search,
          },
          ...context,
        }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ],
    async ({ field, ...query }: TMcpListChartFieldValuesInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await listV3ChartFieldValues({ field, query, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    [{ permission: "dashboards", level: "read" }],
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

  registerMcpTool(
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
    [{ permission: "dashboards", level: "read" }],
    async ({ dashboardId }: TMcpDashboardIdInput, ctx) => {
      const context = toolContext(ctx);
      return await responseToMcpToolResult(
        await getV3Dashboard({ dashboardId, ...context }),
        context.requestId
      );
    }
  );

  registerMcpTool(
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
    [{ permission: "dashboards", level: "write" }],
    async (input: TMcpCreateDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboard", (context) => createV3Dashboard({ body: input, ...context }))
  );

  registerMcpTool(
    server,
    "update_dashboard",
    {
      title: "Rename dashboard",
      description:
        "Rename a dashboard. Only the name changes; move, resize or remove its widgets with update_widget and remove_chart_from_dashboard.",
      inputSchema: ZMcpUpdateDashboardInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "updated", targetType: "dashboard", targetIdArg: "dashboardId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, ...body }: TMcpUpdateDashboardInput, ctx) =>
      runMutation(ctx, "updated", "dashboard", (context) =>
        renameV3Dashboard({ dashboardId, body, ...context })
      )
  );

  registerMcpTool(
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
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, ...body }: TMcpDuplicateDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboard", (context) =>
        duplicateV3Dashboard({ dashboardId, body, ...context })
      )
  );

  registerMcpTool(
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
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, ...body }: TMcpAddChartToDashboardInput, ctx) =>
      runMutation(ctx, "created", "dashboardWidget", (context) =>
        addV3DashboardWidget({ dashboardId, body, ...context })
      )
  );

  registerMcpTool(
    server,
    "update_widget",
    {
      title: "Update widget",
      description:
        "Move or resize a widget, or show another chart in its place, or both. Repointing is how one dashboard gets its own version of a shared chart: duplicate_chart, then point this widget at the copy.",
      inputSchema: ZMcpUpdateWidgetInput,
      outputSchema: ZMcpWidgetOutput,
      audit: { action: "updated", targetType: "dashboardWidget", targetIdArg: "widgetId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, widgetId, ...body }: TMcpUpdateWidgetInput, ctx) =>
      runMutation(ctx, "updated", "dashboardWidget", (context) =>
        updateV3DashboardWidget({ dashboardId, widgetId, body, ...context })
      )
  );

  registerMcpTool(
    server,
    "remove_chart_from_dashboard",
    {
      title: "Remove chart from dashboard",
      description:
        "Take a chart off a dashboard by removing its widget. The chart itself is kept, with every other dashboard it sits on; add it back with add_chart_to_dashboard.",
      inputSchema: ZMcpRemoveChartFromDashboardInput,
      outputSchema: ZMcpAcknowledgement,
      audit: { action: "deleted", targetType: "dashboardWidget", targetIdArg: "widgetId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, widgetId }: TMcpRemoveChartFromDashboardInput, ctx) =>
      runMutation(ctx, "deleted", "dashboardWidget", (context) =>
        removeV3DashboardWidget({ dashboardId, widgetId, ...context })
      )
  );

  registerMcpTool(
    server,
    "update_dashboard_layout",
    {
      title: "Rearrange dashboard",
      description:
        "Move and resize every widget on a dashboard at once, as one change. List every current widget exactly once — a rearrange never removes a widget, and a list that leaves one out is refused. Pass the updatedAt from get_dashboard as expectedUpdatedAt; if the dashboard changed since, nothing is saved.",
      inputSchema: ZMcpUpdateDashboardLayoutInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "updated", targetType: "dashboard", targetIdArg: "dashboardId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, ...body }: TMcpUpdateDashboardLayoutInput, ctx) =>
      runMutation(ctx, "updated", "dashboard", (context) =>
        updateV3DashboardLayout({ dashboardId, body, ...context })
      )
  );

  registerMcpTool(
    server,
    "set_dashboard_filters",
    {
      title: "Set dashboard filters",
      description:
        "Set a dashboard's locked filters: the filters every reader sees applied, Dashboard viewers included, which they cannot remove. Send the whole list — it replaces the saved one, so keep a filter by sending it back as get_dashboard read it, change it by sending it changed, and remove it by leaving it out; an empty list removes them all. Each filter is a field (a dimension from list_chart_fields, or an embedded-data field of a dataset the dashboard's charts read), an operator, a label and its values (none for set/notSet); all of them apply together. gt, gte, lt and lte on an embedded-data field take one number and need the field to be type number in list_dashboard_filter_fields. Pass the updatedAt from get_dashboard as expectedUpdatedAt; if the dashboard changed since, nothing is saved.",
      inputSchema: ZMcpSetDashboardFiltersInput,
      outputSchema: ZMcpDashboardOutput,
      audit: { action: "updated", targetType: "dashboard", targetIdArg: "dashboardId" },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
    },
    [{ permission: "dashboards", level: "write" }],
    async ({ dashboardId, expectedUpdatedAt, filters }: TMcpSetDashboardFiltersInput, ctx) =>
      runMutation(ctx, "updated", "dashboard", (context) =>
        setV3DashboardFilters({
          dashboardId,
          // A new filter gets its id here, as the app gives one when a filter is locked.
          body: {
            expectedUpdatedAt,
            filters: filters.map((filter) => ({ ...filter, id: filter.id ?? createId() })),
          },
          ...context,
        })
      )
  );

  registerMcpTool(
    server,
    "duplicate_chart",
    {
      title: "Duplicate chart",
      description:
        "Copy a chart so the copy can be changed without touching the dashboards that show the original. Pass dashboardId to put the copy on a dashboard in the same step. To give one dashboard its own version of a shared chart, duplicate it, then point that dashboard's widget at the copy with update_widget.",
      inputSchema: ZMcpDuplicateChartInput,
      outputSchema: ZMcpChartOutput,
      audit: { action: "created", targetType: "chart" },
      annotations: WRITE_ANNOTATIONS,
    },
    [{ permission: "charts", level: "write" }],
    async ({ chartId, ...body }: TMcpDuplicateChartInput, ctx) =>
      runMutation(ctx, "created", "chart", (context) => duplicateV3Chart({ chartId, body, ...context }))
  );
}
