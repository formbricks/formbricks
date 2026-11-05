import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { duplicateV3Chart } from "@/app/api/v3/charts/lib/duplicate-operations";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "@/app/api/v3/charts/lib/operations";
import { getV3DashboardChartData } from "@/app/api/v3/dashboards/lib/chart-data-operations";
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
import { MAX_WIDGETS_PER_WRITE } from "@/app/api/v3/dashboards/lib/schemas";
import {
  addV3DashboardWidget,
  removeV3DashboardWidget,
  updateV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/widget-operations";
import { successListResponse, successResponse } from "@/app/api/v3/lib/response";
import { MAX_DASHBOARD_FILTERS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import {
  ZMcpGetChartDataInput,
  ZMcpGetChartDataOutput,
  ZMcpListDashboardFilterValuesInput,
} from "./dashboard-schemas";
import { registerDashboardTools } from "./dashboards";

vi.mock("@/app/api/v3/charts/lib/field-operations", () => ({
  getV3ChartFieldCatalog: vi.fn(),
  listV3ChartFieldValues: vi.fn(),
}));
vi.mock("@/app/api/v3/charts/lib/operations", () => ({
  createV3Chart: vi.fn(),
  getV3Chart: vi.fn(),
  listV3Charts: vi.fn(),
  updateV3Chart: vi.fn(),
}));
vi.mock("@/app/api/v3/charts/lib/duplicate-operations", () => ({ duplicateV3Chart: vi.fn() }));
vi.mock("@/app/api/v3/charts/lib/data-operations", () => ({
  getV3ChartData: vi.fn(),
  previewV3Chart: vi.fn(),
}));
vi.mock("@/app/api/v3/dashboards/lib/chart-data-operations", () => ({
  getV3DashboardChartData: vi.fn(),
}));
vi.mock("@/app/api/v3/dashboards/lib/filter-values-operations", () => ({
  listV3DashboardFilterValues: vi.fn(),
}));
vi.mock("@/app/api/v3/dashboards/lib/operations", () => ({
  createV3Dashboard: vi.fn(),
  duplicateV3Dashboard: vi.fn(),
  getV3Dashboard: vi.fn(),
  listV3Dashboards: vi.fn(),
  renameV3Dashboard: vi.fn(),
  setV3DashboardFilters: vi.fn(),
  updateV3DashboardLayout: vi.fn(),
}));
vi.mock("@/app/api/v3/dashboards/lib/widget-operations", () => ({
  addV3DashboardWidget: vi.fn(),
  removeV3DashboardWidget: vi.fn(),
  updateV3DashboardWidget: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const DATASET_ID = "clds000000000000000000001";
const CHART_ID = "clch000000000000000000001";
const DASHBOARD_ID = "cldb000000000000000000001";
const WIDGET_ID = "clwg000000000000000000001";

const authInfoWith = (scopes: string[], dashboardViewerOnly = false) => ({
  token: "key_1",
  clientId: "key_1",
  scopes,
  extra: {
    formbricksAuthentication: {
      type: "apiKey" as const,
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [
        { workspaceId: WORKSPACE_ID, workspaceName: "W", permission: ApiKeyPermission.manage },
      ],
    },
    requestId: "req_tool",
    ...(dashboardViewerOnly ? { dashboardViewerOnly: true } : {}),
  },
});

type TRegisteredTool = {
  config: Record<string, unknown>;
  handler: (input: unknown, ctx: unknown) => Promise<Record<string, unknown>>;
};

const createToolServer = () => {
  const tools = new Map<string, TRegisteredTool>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: never) => {
      tools.set(name, { config, handler });
    }),
  };
  registerDashboardTools(server as never);
  return tools;
};

const call = async (name: string, input: unknown, scopes: string[], dashboardViewerOnly = false) => {
  const tool = createToolServer().get(name);
  if (!tool) throw new Error(`${name} is not registered`);
  return await tool.handler(input, {
    http: { authInfo: authInfoWith(scopes, dashboardViewerOnly) },
    mcpReq: { method: "tools/call" },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getV3ChartFieldCatalog).mockResolvedValue(
    successResponse({ fields: [], datePresets: [] }, { requestId: "req" })
  );
  vi.mocked(listV3Charts).mockResolvedValue(successResponse([], { requestId: "req" }));
  vi.mocked(getV3Chart).mockResolvedValue(successResponse({}, { requestId: "req" }));
  vi.mocked(previewV3Chart).mockResolvedValue(successResponse({}, { requestId: "req" }));
  vi.mocked(createV3Chart).mockResolvedValue(successResponse({}, { requestId: "req" }));
  vi.mocked(updateV3Chart).mockResolvedValue(successResponse({}, { requestId: "req" }));
});

describe("chart and dashboard MCP tools", () => {
  test("list_chart_fields answers from the field catalog operation with the caller's context", async () => {
    const result = await call("list_chart_fields", { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID }, [
      "dashboards:read",
      "feedbackRecords:read",
    ]);

    expect(result.isError).toBeUndefined();
    expect(getV3ChartFieldCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        datasetId: DATASET_ID,
        requestId: "req_tool",
        authentication: expect.objectContaining({ apiKeyId: "key_1" }),
      })
    );
  });

  test("list_chart_fields is refused without dashboards:read, before the operation runs", async () => {
    const result = await call("list_chart_fields", { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID }, [
      "feedbackRecords:read",
    ]);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { status: 403 } });
    expect(getV3ChartFieldCatalog).not.toHaveBeenCalled();
  });

  test("list_charts maps its arguments onto the v3 list query", async () => {
    await call(
      "list_charts",
      { workspaceId: WORKSPACE_ID, limit: 5, cursor: "abc", nameContains: "NPS", datasetId: DATASET_ID },
      ["dashboards:read", "feedbackRecords:read"]
    );

    expect(listV3Charts).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          workspaceId: WORKSPACE_ID,
          limit: 5,
          cursor: "abc",
          "filter[name][contains]": "NPS",
          "filter[datasetId][eq]": DATASET_ID,
        },
      })
    );
  });

  test("get_chart reads one chart and is refused without dashboards:read", async () => {
    await call("get_chart", { chartId: CHART_ID }, ["dashboards:read", "feedbackRecords:read"]);
    expect(getV3Chart).toHaveBeenCalledWith(expect.objectContaining({ chartId: CHART_ID }));

    vi.mocked(getV3Chart).mockClear();
    const refused = await call("get_chart", { chartId: CHART_ID }, ["dashboards:write"]);
    expect(refused.isError).toBe(true);
    expect(getV3Chart).not.toHaveBeenCalled();
  });

  // ADR-0025: a Dashboard viewer's token is trimmed to `dashboards:read`, and the chart operations 403 it.
  // The scope gate refuses it first, as it does preview_chart, so the client sees why.
  test.each([
    ["list_chart_fields", { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID }],
    ["list_charts", { workspaceId: WORKSPACE_ID }],
    ["get_chart", { chartId: CHART_ID }],
  ] as const)(
    "%s needs feedbackRecords:read, so a viewer's dashboards:read token is refused",
    async (name, input) => {
      const result = await call(name, input, ["dashboards:read"], true);

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ error: { status: 403 } });
      expect(getV3ChartFieldCatalog).not.toHaveBeenCalled();
      expect(listV3Charts).not.toHaveBeenCalled();
      expect(getV3Chart).not.toHaveBeenCalled();
    }
  );

  test("preview_chart needs feedbackRecords:read on top of dashboards:read, because it returns data", async () => {
    const input = {
      workspaceId: WORKSPACE_ID,
      datasetId: DATASET_ID,
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      dateRange: "last 7 days",
    };

    const refused = await call("preview_chart", input, ["dashboards:read"]);
    expect(refused.isError).toBe(true);
    expect(previewV3Chart).not.toHaveBeenCalled();

    await call("preview_chart", input, ["dashboards:read", "feedbackRecords:read"]);
    expect(previewV3Chart).toHaveBeenCalledWith(expect.objectContaining({ body: input }));
  });

  test("create_chart and update_chart need dashboards:write and reach the operations with an audit log", async () => {
    const chart = {
      workspaceId: WORKSPACE_ID,
      datasetId: DATASET_ID,
      name: "NPS",
      type: "bar",
      query: { measures: ["FeedbackRecords.npsScore"] },
    };

    expect((await call("create_chart", chart, ["dashboards:read"])).isError).toBe(true);
    expect(createV3Chart).not.toHaveBeenCalled();

    await call("create_chart", chart, ["dashboards:write"]);
    expect(createV3Chart).toHaveBeenCalledWith(
      expect.objectContaining({ body: chart, instance: "/api/mcp", requestId: "req_tool" })
    );

    await call("update_chart", { chartId: CHART_ID, name: "Renamed" }, ["dashboards:write"]);
    expect(updateV3Chart).toHaveBeenCalledWith(
      expect.objectContaining({ chartId: CHART_ID, body: { name: "Renamed" } })
    );
  });

  test("update_chart warns that an edit shows on every dashboard holding the chart", () => {
    const description = String(createToolServer().get("update_chart")?.config.description);
    expect(description).toMatch(/every one of them/);
  });

  test("the free-form value lookup needs feedbackRecords:read on top of dashboards:read", async () => {
    vi.mocked(listV3ChartFieldValues).mockResolvedValue(successResponse([], { requestId: "req" }));
    const input = { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID, field: "FeedbackRecords.sourceName" };

    expect((await call("list_chart_field_values", input, ["dashboards:read"])).isError).toBe(true);
    expect(listV3ChartFieldValues).not.toHaveBeenCalled();

    await call("list_chart_field_values", input, ["dashboards:read", "feedbackRecords:read"]);
    expect(listV3ChartFieldValues).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "FeedbackRecords.sourceName",
        query: { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID },
      })
    );
  });

  test("get_chart_data without a dashboardId reads the chart as before and still needs feedbackRecords:read (S1)", async () => {
    vi.mocked(getV3ChartData).mockResolvedValue(successResponse({}, { requestId: "req" }));

    const refused = await call("get_chart_data", { chartId: CHART_ID }, ["dashboards:read"]);
    expect(refused.isError).toBe(true);
    expect(getV3ChartData).not.toHaveBeenCalled();

    const result = await call("get_chart_data", { chartId: CHART_ID, dateRange: "last_7_days" }, [
      "dashboards:read",
      "feedbackRecords:read",
    ]);
    expect(result.isError).toBeFalsy();
    expect(getV3ChartData).toHaveBeenCalledWith(
      expect.objectContaining({ chartId: CHART_ID, query: { dateRange: "last_7_days" } })
    );
    expect(getV3DashboardChartData).not.toHaveBeenCalled();
  });

  test("get_chart_data through a dashboard still needs feedbackRecords:read from anyone but a Dashboard viewer (S1)", async () => {
    vi.mocked(getV3DashboardChartData).mockResolvedValue(successResponse({}, { requestId: "req" }));

    const refused = await call("get_chart_data", { dashboardId: DASHBOARD_ID, chartId: CHART_ID }, [
      "dashboards:read",
    ]);
    expect(refused.isError).toBe(true);
    expect(getV3DashboardChartData).not.toHaveBeenCalled();

    const allowed = await call("get_chart_data", { dashboardId: DASHBOARD_ID, chartId: CHART_ID }, [
      "dashboards:read",
      "feedbackRecords:read",
    ]);
    expect(allowed.isError).toBeFalsy();
    expect(getV3DashboardChartData).toHaveBeenCalledTimes(1);
  });

  test("get_chart_data reads a saved chart through its dashboard under dashboards:read alone for a Dashboard viewer (ADR-0025)", async () => {
    vi.mocked(getV3DashboardChartData).mockResolvedValue(successResponse({}, { requestId: "req" }));

    const result = await call(
      "get_chart_data",
      {
        dashboardId: DASHBOARD_ID,
        chartId: CHART_ID,
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        filters: [{ field: "FeedbackRecords.sourceName", operator: "equals", values: ["Web"] }],
      },
      ["dashboards:read"],
      true
    );

    expect(result.isError).toBeFalsy();
    expect(getV3DashboardChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: DASHBOARD_ID,
        chartId: CHART_ID,
        query: {
          from: "2026-01-01",
          to: "2026-01-31",
          rules: { f1: "equals:FeedbackRecords.sourceName" },
          picks: { f1: ["Web"] },
        },
      })
    );
  });

  test("get_chart_data refuses a viewer without a dashboardId (S1)", async () => {
    const result = await call("get_chart_data", { chartId: CHART_ID }, ["dashboards:read"], true);
    expect(result.isError).toBe(true);
    expect(getV3ChartData).not.toHaveBeenCalled();
  });

  test("list_dashboards maps its filters and get_dashboard reads one, both under dashboards:read", async () => {
    vi.mocked(listV3Dashboards).mockResolvedValue(successResponse([], { requestId: "req" }));
    vi.mocked(getV3Dashboard).mockResolvedValue(successResponse({}, { requestId: "req" }));

    await call(
      "list_dashboards",
      { workspaceId: WORKSPACE_ID, limit: 20, chartId: CHART_ID, nameContains: "Event" },
      ["dashboards:read"]
    );
    expect(listV3Dashboards).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          workspaceId: WORKSPACE_ID,
          limit: 20,
          cursor: undefined,
          "filter[name][contains]": "Event",
          "filter[chartId][eq]": CHART_ID,
        },
      })
    );

    await call("get_dashboard", { dashboardId: "cldb000000000000000000001" }, ["dashboards:read"]);
    expect(getV3Dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: "cldb000000000000000000001" })
    );
  });

  test("create_dashboard, update_dashboard and duplicate_dashboard need dashboards:write", async () => {
    for (const operation of [createV3Dashboard, renameV3Dashboard, duplicateV3Dashboard]) {
      vi.mocked(operation).mockResolvedValue(successResponse({}, { requestId: "req" }));
    }
    const writes = [
      ["create_dashboard", { workspaceId: WORKSPACE_ID, name: "Matchday" }],
      ["update_dashboard", { dashboardId: DASHBOARD_ID, name: "Matchday 2" }],
      ["duplicate_dashboard", { dashboardId: DASHBOARD_ID }],
    ] as const;

    for (const [name, input] of writes) {
      expect((await call(name, input, ["dashboards:read"])).isError).toBe(true);
    }
    expect(createV3Dashboard).not.toHaveBeenCalled();
    expect(renameV3Dashboard).not.toHaveBeenCalled();
    expect(duplicateV3Dashboard).not.toHaveBeenCalled();

    for (const [name, input] of writes) await call(name, input, ["dashboards:write"]);
    expect(createV3Dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ body: { workspaceId: WORKSPACE_ID, name: "Matchday" }, instance: "/api/mcp" })
    );
    expect(renameV3Dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: DASHBOARD_ID, body: { name: "Matchday 2" } })
    );
    expect(duplicateV3Dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: DASHBOARD_ID, body: {} })
    );
  });

  test("duplicate_dashboard warns the copy shares its charts, and no tool deletes anything", () => {
    const tools = createToolServer();
    expect(String(tools.get("duplicate_dashboard")?.config.description)).toMatch(
      /shares the original's charts/
    );
    expect([...tools.keys()].filter((name) => /delete/.test(name))).toEqual([]);
  });

  test("the widget tools need dashboards:write and map their arguments onto the operations", async () => {
    vi.mocked(addV3DashboardWidget).mockResolvedValue(successResponse({}, { requestId: "req" }));
    vi.mocked(updateV3DashboardWidget).mockResolvedValue(successResponse({}, { requestId: "req" }));
    vi.mocked(removeV3DashboardWidget).mockResolvedValue(new Response(null, { status: 204 }));
    const layout = { x: 0, y: 0, w: 6, h: 4 };
    const writes = [
      ["add_chart_to_dashboard", { dashboardId: DASHBOARD_ID, chartId: CHART_ID, layout }],
      ["update_widget", { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, chartId: CHART_ID }],
      ["remove_chart_from_dashboard", { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID }],
    ] as const;

    for (const [name, input] of writes) {
      expect((await call(name, input, ["dashboards:read"])).isError).toBe(true);
    }
    expect(addV3DashboardWidget).not.toHaveBeenCalled();

    const results = [];
    for (const [name, input] of writes) results.push(await call(name, input, ["dashboards:write"]));
    expect(results.map((result) => result.isError)).toEqual([undefined, undefined, undefined]);
    expect(addV3DashboardWidget).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: DASHBOARD_ID, body: { chartId: CHART_ID, layout } })
    );
    expect(updateV3DashboardWidget).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, body: { chartId: CHART_ID } })
    );
    expect(removeV3DashboardWidget).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID })
    );
  });

  test("remove_chart_from_dashboard says the chart is kept", () => {
    const description = String(createToolServer().get("remove_chart_from_dashboard")?.config.description);
    expect(description).toMatch(/chart itself is kept/);
  });

  test("update_dashboard_layout needs dashboards:write and passes the precondition through", async () => {
    vi.mocked(updateV3DashboardLayout).mockResolvedValue(successResponse({}, { requestId: "req" }));
    const input = {
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: "2026-10-22T10:00:00.000Z",
      widgets: [{ widgetId: WIDGET_ID, layout: { x: 0, y: 0, w: 12, h: 4 } }],
    };

    expect((await call("update_dashboard_layout", input, ["dashboards:read"])).isError).toBe(true);
    expect(updateV3DashboardLayout).not.toHaveBeenCalled();

    await call("update_dashboard_layout", input, ["dashboards:write"]);
    expect(updateV3DashboardLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: DASHBOARD_ID,
        body: { expectedUpdatedAt: input.expectedUpdatedAt, widgets: input.widgets },
      })
    );
  });

  test("set_dashboard_filters needs dashboards:write, keeps sent ids and gives new filters one", async () => {
    vi.mocked(setV3DashboardFilters).mockResolvedValue(successResponse({}, { requestId: "req" }));
    const kept = {
      id: "clfi000000000000000000001",
      field: "FeedbackRecords.sourceName",
      operator: "equals" as const,
      label: "Source",
      values: ["Web"],
    };
    const added = {
      field: "FeedbackRecords.ed_plan_64879f7d",
      operator: "equals" as const,
      label: "Plan",
      values: ["Pro"],
    };
    const input = {
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt: "2026-10-22T10:00:00.000Z",
      filters: [kept, added],
    };

    expect((await call("set_dashboard_filters", input, ["dashboards:read"])).isError).toBe(true);
    expect(setV3DashboardFilters).not.toHaveBeenCalled();

    await call("set_dashboard_filters", input, ["dashboards:write"]);
    const { body } = vi.mocked(setV3DashboardFilters).mock.calls[0][0];
    expect(body.expectedUpdatedAt).toBe(input.expectedUpdatedAt);
    expect(body.filters[0]).toEqual(kept);
    expect(body.filters[1]).toEqual({ ...added, id: expect.stringMatching(/^[a-z][a-z0-9]{23}$/) });
    expect(vi.mocked(setV3DashboardFilters).mock.calls[0][0].dashboardId).toBe(DASHBOARD_ID);
  });

  test("set_dashboard_filters removes every locked filter with an empty list", async () => {
    vi.mocked(setV3DashboardFilters).mockResolvedValue(successResponse({}, { requestId: "req" }));
    await call(
      "set_dashboard_filters",
      { dashboardId: DASHBOARD_ID, expectedUpdatedAt: "2026-10-22T10:00:00.000Z", filters: [] },
      ["dashboards:write"]
    );
    expect(setV3DashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ body: { expectedUpdatedAt: "2026-10-22T10:00:00.000Z", filters: [] } })
    );
  });

  test("duplicate_chart needs dashboards:write and can place the copy in the same call", async () => {
    vi.mocked(duplicateV3Chart).mockResolvedValue(successResponse({}, { requestId: "req" }));
    const input = { chartId: CHART_ID, dashboardId: DASHBOARD_ID, layout: { x: 0, y: 4, w: 6, h: 4 } };

    expect((await call("duplicate_chart", input, ["dashboards:read"])).isError).toBe(true);
    expect(duplicateV3Chart).not.toHaveBeenCalled();

    await call("duplicate_chart", input, ["dashboards:write"]);
    expect(duplicateV3Chart).toHaveBeenCalledWith(
      expect.objectContaining({
        chartId: CHART_ID,
        body: { dashboardId: DASHBOARD_ID, layout: input.layout },
      })
    );
  });

  test("write inputs carry the REST body's checks, which the SDK runs before the handler", () => {
    // The SDK validates arguments against the registered schema instance (Standard Schema), refinements
    // included, so these are the requests an agent gets refused before any operation runs.
    const tools = createToolServer();
    const accepts = (name: string, input: unknown) =>
      (
        tools.get(name)?.config.inputSchema as { safeParse: (value: unknown) => { success: boolean } }
      ).safeParse(input).success;
    const layout = { x: 0, y: 0, w: 6, h: 4 };
    const widgets = (ids: string[]) => ids.map((widgetId) => ({ widgetId, layout }));
    const expectedUpdatedAt = "2026-10-22T10:00:00.000Z";

    expect(accepts("update_widget", { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID })).toBe(false);
    expect(accepts("update_widget", { dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, layout })).toBe(true);

    expect(accepts("duplicate_chart", { chartId: CHART_ID, layout })).toBe(false);
    expect(accepts("duplicate_chart", { chartId: CHART_ID, dashboardId: DASHBOARD_ID, layout })).toBe(true);

    const layoutInput = (ids: string[]) => ({
      dashboardId: DASHBOARD_ID,
      expectedUpdatedAt,
      widgets: widgets(ids),
    });
    expect(accepts("update_dashboard_layout", layoutInput([WIDGET_ID, WIDGET_ID]))).toBe(false);
    // Distinct ids, so the bound is the only thing refusing the list.
    const distinctIds = (count: number) =>
      Array.from({ length: count }, (_, index) => `clwg${String(index).padStart(21, "0")}`);
    expect(accepts("update_dashboard_layout", layoutInput(distinctIds(MAX_WIDGETS_PER_WRITE + 1)))).toBe(
      false
    );
    expect(accepts("update_dashboard_layout", layoutInput(distinctIds(MAX_WIDGETS_PER_WRITE)))).toBe(true);

    // The locked filters carry the PUT body's checks: a field outside the catalog, an operator the field
    // does not allow, a repeated id, more than MAX_DASHBOARD_FILTERS. New filters (no id) never clash.
    const filter = {
      field: "FeedbackRecords.sourceName",
      operator: "equals",
      label: "Source",
      values: ["Web"],
    };
    const filtersInput = (filters: unknown[]) => ({ dashboardId: DASHBOARD_ID, expectedUpdatedAt, filters });
    expect(accepts("set_dashboard_filters", filtersInput([filter, filter]))).toBe(true);
    expect(
      accepts("set_dashboard_filters", filtersInput([{ ...filter, field: "FeedbackRecords.count" }]))
    ).toBe(false);
    expect(accepts("set_dashboard_filters", filtersInput([{ ...filter, operator: "gt" }]))).toBe(false);
    const id = "clfi000000000000000000001";
    expect(
      accepts(
        "set_dashboard_filters",
        filtersInput([
          { ...filter, id },
          { ...filter, id },
        ])
      )
    ).toBe(false);
    expect(
      accepts(
        "set_dashboard_filters",
        filtersInput(Array.from({ length: MAX_DASHBOARD_FILTERS + 1 }, () => filter))
      )
    ).toBe(false);
    expect(accepts("set_dashboard_filters", { ...filtersInput([]), workspaceId: WORKSPACE_ID })).toBe(false);
  });

  test("marks the tools that overwrite or remove something destructive, as the other update tools are", () => {
    const tools = createToolServer();
    const destructive = [...tools]
      .filter(([, tool]) => (tool.config.annotations as { destructiveHint?: boolean }).destructiveHint)
      .map(([name]) => name)
      .sort();

    expect(destructive).toEqual(
      [
        "remove_chart_from_dashboard",
        "set_dashboard_filters",
        "update_chart",
        "update_dashboard",
        "update_dashboard_layout",
        "update_widget",
      ].sort()
    );
  });

  test("list_charts and list_dashboards answer what their own output schema accepts", async () => {
    // The list operations answer v3's cursor envelope ({ limit, nextCursor }, no totals). The SDK
    // validates structured content against `outputSchema`, so a schema that wants more fails every call.
    const page = () => successListResponse([], { limit: 5, nextCursor: null }, { requestId: "req" });
    vi.mocked(listV3Charts).mockResolvedValue(page());
    vi.mocked(listV3Dashboards).mockResolvedValue(page());
    const tools = createToolServer();

    for (const [name, input] of [
      ["list_charts", { workspaceId: WORKSPACE_ID, limit: 5 }],
      ["list_dashboards", { workspaceId: WORKSPACE_ID, limit: 5 }],
    ] as const) {
      const result = await call(name, input, ["dashboards:read", "feedbackRecords:read"]);
      const outputSchema = tools.get(name)?.config.outputSchema as {
        safeParse: (value: unknown) => { success: boolean };
      };
      expect(result.isError).toBeUndefined();
      expect(outputSchema.safeParse(result.structuredContent).success).toBe(true);
    }
  });
});

describe("get_chart_data schemas (S1)", () => {
  const filter = (value: string) => [
    { field: "FeedbackRecords.sourceName", operator: "equals", values: [value] },
  ];

  test("dashboardId is optional, and filters need one", () => {
    expect(ZMcpGetChartDataInput.safeParse({ chartId: CHART_ID }).success).toBe(true);
    expect(ZMcpGetChartDataInput.safeParse({ chartId: CHART_ID, filters: filter("Web") }).success).toBe(
      false
    );
  });

  test("filter values go through the same text rules as picks, which refuse a NUL byte", () => {
    const input = (value: string) => ({
      dashboardId: DASHBOARD_ID,
      chartId: CHART_ID,
      filters: filter(value),
    });
    expect(ZMcpGetChartDataInput.safeParse(input("Web")).success).toBe(true);
    expect(ZMcpGetChartDataInput.safeParse(input("We\u0000b")).success).toBe(false);
  });

  test("the output keeps the old shape and adds unfilterableFilters only as an optional field", () => {
    const base = { rows: [], optionLabels: {}, fieldLabels: {}, memberLabels: {}, query: {} };
    expect(ZMcpGetChartDataOutput.safeParse({ data: base }).success).toBe(true);
    expect(ZMcpGetChartDataOutput.safeParse({ data: { ...base, unfilterableFilters: [] } }).success).toBe(
      true
    );
  });
});

describe("list_dashboard_filter_values", () => {
  const FIELD = "FeedbackRecords.sourceName";
  const VALUES = { values: [{ value: "Web" }], hasMore: false };

  beforeEach(() => {
    vi.mocked(listV3DashboardFilterValues).mockResolvedValue(successResponse(VALUES, { requestId: "req" }));
  });

  test("lists a dashboard filter's values through its dashboard, with the date range, picks and search", async () => {
    const result = await call(
      "list_dashboard_filter_values",
      {
        dashboardId: DASHBOARD_ID,
        field: FIELD,
        dateRange: "last_7_days",
        filters: [{ field: "FeedbackRecords.metadataDevice", operator: "equals", values: ["Pro"] }],
        search: "we",
      },
      ["dashboards:read", "feedbackRecords:read"]
    );

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ data: VALUES });
    expect(listV3DashboardFilterValues).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: DASHBOARD_ID,
        filterId: "f1",
        query: {
          dateRange: "last_7_days",
          rules: { f1: "equals:FeedbackRecords.sourceName", f2: "equals:FeedbackRecords.metadataDevice" },
          picks: { f2: ["Pro"] },
          search: "we",
        },
      })
    );
  });

  test("a Dashboard viewer lists values under dashboards:read alone, as it reads the dashboard's charts", async () => {
    const result = await call(
      "list_dashboard_filter_values",
      { dashboardId: DASHBOARD_ID, field: FIELD },
      ["dashboards:read"],
      true
    );

    expect(result.isError).toBeFalsy();
    expect(listV3DashboardFilterValues).toHaveBeenCalledTimes(1);
  });

  test("anyone else also needs feedbackRecords:read, since the values are what respondents answered", async () => {
    const result = await call("list_dashboard_filter_values", { dashboardId: DASHBOARD_ID, field: FIELD }, [
      "dashboards:read",
    ]);

    expect(result.isError).toBe(true);
    expect(listV3DashboardFilterValues).not.toHaveBeenCalled();
  });

  test("its input is strict, takes only equals and notEquals, and is read-only", () => {
    expect(
      ZMcpListDashboardFilterValuesInput.safeParse({ dashboardId: DASHBOARD_ID, field: FIELD }).success
    ).toBe(true);
    expect(
      ZMcpListDashboardFilterValuesInput.safeParse({
        dashboardId: DASHBOARD_ID,
        field: FIELD,
        operator: "contains",
      }).success
    ).toBe(false);
    expect(
      ZMcpListDashboardFilterValuesInput.safeParse({
        dashboardId: DASHBOARD_ID,
        field: FIELD,
        workspaceId: WORKSPACE_ID,
      }).success
    ).toBe(false);
    const tool = createToolServer().get("list_dashboard_filter_values");
    expect(tool?.config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  });
});
