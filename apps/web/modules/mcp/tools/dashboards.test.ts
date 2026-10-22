import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { getV3ChartFieldCatalog } from "@/app/api/v3/charts/lib/field-operations";
import { successResponse } from "@/app/api/v3/lib/response";
import { registerDashboardTools } from "./dashboards";

vi.mock("@/app/api/v3/charts/lib/field-operations", () => ({ getV3ChartFieldCatalog: vi.fn() }));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const DATASET_ID = "clds000000000000000000001";

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
});
