import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { successResponse } from "@/app/api/v3/lib/response";
import { sendWorkflowTestRequest } from "@/app/api/v3/workflows/lib/test-request";
import { registerWorkflowTestRequestTools } from "./workflow-test-request";

vi.mock("@/app/api/v3/workflows/lib/test-request", () => ({ sendWorkflowTestRequest: vi.fn() }));
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
  registerWorkflowTestRequestTools(server as any);
  return tools;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as any);
  vi.mocked(sendWorkflowTestRequest).mockResolvedValue(
    successResponse(
      { request: { method: "GET", url: "https://api.example.com", headers: [] }, response: null, error: "x" },
      { requestId: "req_tool" }
    )
  );
});

describe("registerWorkflowTestRequestTools", () => {
  test("registers send_test_request", () => {
    expect([...createToolServer().keys()]).toEqual(["send_test_request"]);
  });

  test("needs workflows:write, since it makes a real outbound call", async () => {
    const tools = createToolServer();

    const result = await tools
      .get("send_test_request")!
      .handler({ workflowId: WORKFLOW_ID, stepId: "call" }, { http: { authInfo: readOnlyAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, code: "forbidden" });
    expect(sendWorkflowTestRequest).not.toHaveBeenCalled();
  });

  test("calls the shared v3 operation and is audited as testRequestSent", async () => {
    const tools = createToolServer();

    await tools
      .get("send_test_request")!
      .handler(
        { workflowId: WORKFLOW_ID, stepId: "call", variables: { payload: { id: 1 } } },
        { http: { authInfo } }
      );

    expect(sendWorkflowTestRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { workflowId: WORKFLOW_ID, stepId: "call" },
        input: { variables: { payload: { id: 1 } } },
      })
    );
    expect(vi.mocked(buildV3AuditLog).mock.calls[0][1]).toBe("testRequestSent");
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("tells the agent the response body is untrusted", () => {
    expect(createToolServer().get("send_test_request")?.config.description).toContain("untrusted");
  });
});
