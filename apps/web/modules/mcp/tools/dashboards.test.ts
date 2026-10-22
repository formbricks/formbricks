import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { getV3ChartData, previewV3Chart } from "@/app/api/v3/charts/lib/data-operations";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "@/app/api/v3/charts/lib/field-operations";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "@/app/api/v3/charts/lib/operations";
import { successResponse } from "@/app/api/v3/lib/response";
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
vi.mock("@/app/api/v3/charts/lib/data-operations", () => ({
  getV3ChartData: vi.fn(),
  previewV3Chart: vi.fn(),
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

const authInfoWith = (scopes: string[]) => ({
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

const call = async (name: string, input: unknown, scopes: string[]) => {
  const tool = createToolServer().get(name);
  if (!tool) throw new Error(`${name} is not registered`);
  return await tool.handler(input, {
    http: { authInfo: authInfoWith(scopes) },
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
      ["dashboards:read"]
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
    await call("get_chart", { chartId: CHART_ID }, ["dashboards:read"]);
    expect(getV3Chart).toHaveBeenCalledWith(expect.objectContaining({ chartId: CHART_ID }));

    vi.mocked(getV3Chart).mockClear();
    const refused = await call("get_chart", { chartId: CHART_ID }, ["dashboards:write"]);
    expect(refused.isError).toBe(true);
    expect(getV3Chart).not.toHaveBeenCalled();
  });

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

  test("every tool that returns respondent data needs feedbackRecords:read on top of dashboards:read", async () => {
    vi.mocked(getV3ChartData).mockResolvedValue(successResponse({}, { requestId: "req" }));
    vi.mocked(listV3ChartFieldValues).mockResolvedValue(successResponse([], { requestId: "req" }));
    const dataTools = [
      ["get_chart_data", { chartId: CHART_ID, dateRange: { from: "2026-01-01", to: "2026-01-31" } }],
      [
        "list_chart_field_values",
        { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID, field: "FeedbackRecords.sourceName" },
      ],
    ] as const;

    for (const [name, input] of dataTools) {
      expect((await call(name, input, ["dashboards:read"])).isError).toBe(true);
    }
    expect(getV3ChartData).not.toHaveBeenCalled();
    expect(listV3ChartFieldValues).not.toHaveBeenCalled();

    for (const [name, input] of dataTools)
      await call(name, input, ["dashboards:read", "feedbackRecords:read"]);
    expect(getV3ChartData).toHaveBeenCalledWith(
      expect.objectContaining({ chartId: CHART_ID, query: { from: "2026-01-01", to: "2026-01-31" } })
    );
    expect(listV3ChartFieldValues).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "FeedbackRecords.sourceName",
        query: { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID },
      })
    );
  });
});
