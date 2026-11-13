import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { startWorkflowTestRun } from "@/app/api/v3/workflows/lib/test-run";
import { registerWorkflowTestRunTools } from "./workflow-test-run";

vi.mock("@/app/api/v3/workflows/lib/test-run", () => ({ startWorkflowTestRun: vi.fn() }));
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
  registerWorkflowTestRunTools(server as any);
  return tools;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as any);
  vi.mocked(startWorkflowTestRun).mockResolvedValue(
    Response.json({ code: "invalid_workflow_state" }, { status: 422 })
  );
});

describe("registerWorkflowTestRunTools", () => {
  test("registers run_test", () => {
    expect([...createToolServer().keys()]).toEqual(["run_test"]);
  });

  test("needs workflows:write, since it saves a run", async () => {
    const result = await createToolServer()
      .get("run_test")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: readOnlyAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, code: "forbidden" });
    expect(startWorkflowTestRun).not.toHaveBeenCalled();
  });

  test("calls the shared v3 operation with the payload as the body, audited as testRunStarted", async () => {
    await createToolServer()
      .get("run_test")!
      .handler({ workflowId: WORKFLOW_ID, payload: { plan: "pro" } }, { http: { authInfo } });

    const call = vi.mocked(startWorkflowTestRun).mock.calls[0][0];
    expect(call.params).toEqual({ workflowId: WORKFLOW_ID });
    expect(await call.req.json()).toEqual({ payload: { plan: "pro" } });
    expect(vi.mocked(buildV3AuditLog).mock.calls[0][1]).toBe("testRunStarted");
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("tells the agent that payload values and responses are untrusted", () => {
    expect(createToolServer().get("run_test")?.config.description).toContain("untrusted");
  });
});
