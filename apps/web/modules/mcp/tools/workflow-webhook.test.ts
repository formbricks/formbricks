import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { successResponse } from "@/app/api/v3/lib/response";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { registerWorkflowWebhookTools } from "./workflow-webhook";

vi.mock("@/app/api/v3/workflows/lib/context", () => ({
  buildWorkflowApiContext: vi.fn(() => ({ __ctx: true })),
  workflowsHandlers: { getWebhook: vi.fn(), regenerateWebhook: vi.fn(), setSample: vi.fn() },
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const WORKSPACE_ID = "clxx1234567890123456789012";
const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["workflows:read", "workflows:write"],
  extra: {
    formbricksAuthentication: {
      type: "apiKey" as const,
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [
        { workspaceId: WORKSPACE_ID, workspaceName: "Workspace", permission: ApiKeyPermission.write },
      ],
    },
    requestId: "req_tool",
  },
};
const readOnlyAuthInfo = {
  ...authInfo,
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["workflows:read"],
  extra: { ...authInfo.extra, authMethod: "oauth" },
};

const createToolServer = () => {
  const tools = new Map<
    string,
    { config: Record<string, unknown>; handler: (input: any, extra: any) => any }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };
  registerWorkflowWebhookTools(server as any);
  return { server, tools };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as any);
  vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as any);
  for (const handler of Object.values(workflowsHandlers)) {
    vi.mocked(handler).mockResolvedValue(
      successResponse({ workflowId: WORKFLOW_ID }, { requestId: "req_tool" })
    );
  }
});

describe("registerWorkflowWebhookTools", () => {
  test("registers the three webhook tools", () => {
    const { tools } = createToolServer();

    expect([...tools.keys()]).toEqual(["get_webhook_url", "regenerate_webhook_url", "set_sample_payload"]);
  });

  test("get_webhook_url says the result is a credential", () => {
    const { tools } = createToolServer();

    expect(tools.get("get_webhook_url")?.config.description).toContain("credential");
  });

  test.each([
    ["get_webhook_url", "getWebhook", { workflowId: WORKFLOW_ID }],
    ["regenerate_webhook_url", "regenerateWebhook", { workflowId: WORKFLOW_ID }],
    ["set_sample_payload", "setSample", { workflowId: WORKFLOW_ID, payload: { order: 1 } }],
  ] as const)("%s needs workflows:write, even to read the URL", async (name, handlerKey, input) => {
    const { tools } = createToolServer();

    const result = await tools.get(name)!.handler(input, { http: { authInfo: readOnlyAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, code: "forbidden" });
    expect(workflowsHandlers[handlerKey]).not.toHaveBeenCalled();
  });

  test("regenerate_webhook_url is audited as webhookUrlRegenerated", async () => {
    const { tools } = createToolServer();

    await tools.get("regenerate_webhook_url")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(workflowsHandlers.regenerateWebhook).toHaveBeenCalledTimes(1);
    expect(vi.mocked(buildV3AuditLog).mock.calls[0][1]).toBe("webhookUrlRegenerated");
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("set_sample_payload is a mutation: audited as updated on the workflow, success on 200", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);

    await tools
      .get("set_sample_payload")!
      .handler({ workflowId: WORKFLOW_ID, payload: { order: 1 } }, { http: { authInfo } });

    expect(vi.mocked(buildV3AuditLog).mock.calls[0].slice(1, 3)).toEqual(["updated", "workflow"]);
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.anything());
    // The operation records the target through the audit log it was given.
    expect(vi.mocked(buildWorkflowApiContext).mock.calls[0][3]).toBe(auditLog);
  });

  test("set_sample_payload hands the payload to the v3 operation as its body", async () => {
    const { tools } = createToolServer();

    await tools
      .get("set_sample_payload")!
      .handler({ workflowId: WORKFLOW_ID, payload: { order: { id: 1 } } }, { http: { authInfo } });

    const { req, params } = vi.mocked(workflowsHandlers.setSample).mock.calls[0][0];
    expect(params).toEqual({ workflowId: WORKFLOW_ID });
    expect(await req.json()).toEqual({ payload: { order: { id: 1 } } });
  });

  test("set_sample_payload refuses unknown keys", () => {
    const { tools } = createToolServer();
    const schema = tools.get("set_sample_payload")!.config.inputSchema as {
      safeParse: (value: unknown) => { success: boolean };
    };

    expect(schema.safeParse({ workflowId: WORKFLOW_ID, payload: {}, extra: 1 }).success).toBe(false);
  });
});
