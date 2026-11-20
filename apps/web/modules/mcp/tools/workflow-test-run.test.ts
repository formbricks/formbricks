import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { startWorkflowTestRun } from "@/app/api/v3/workflows/lib/test-run";
import type { TToolHandler } from "./test-utils";
import { withoutRunRespondentData } from "./workflow-run-redaction";
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
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerWorkflowTestRunTools(server as unknown as Parameters<typeof registerWorkflowTestRunTools>[0]);
  return tools;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as unknown as ReturnType<
    typeof buildV3AuditLog
  >);
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

  describe("respondent data", () => {
    const run = {
      id: "run_1",
      status: "completed",
      error: null,
      triggerPayload: { email: "ana@example.com" },
      data: { answer: "Too expensive" },
      steps: [{ stepId: "n1", status: "succeeded", detail: { to: "ana@example.com" } }],
      logs: [{ nodeId: "n1", input: { to: "ana@example.com" }, output: { sent: false }, error: null }],
    };
    const callWith = async (caller: typeof authInfo) => {
      vi.mocked(startWorkflowTestRun).mockResolvedValue(Response.json({ data: run }, { status: 201 }));
      return createToolServer()
        .get("run_test")!
        .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: caller } });
    };

    test("leaves the respondent-derived fields out without Responses: Read, as get_workflow_run does", async () => {
      const result = await callWith(authInfo);

      expect(result.structuredContent.data).toEqual({
        ...run,
        triggerPayload: null,
        data: null,
        steps: null,
        logs: [{ nodeId: "n1", input: null, output: null, error: null }],
      });
      expect(JSON.stringify(result.content)).not.toContain("ana@example.com");
    });

    test("returns the run whole to a caller holding responses:read", async () => {
      const result = await callWith({
        ...authInfo,
        scopes: ["workflows:read", "workflows:write", "responses:read"],
      });

      expect(result.structuredContent.data).toEqual(run);
    });
  });

  test("declares an outputSchema a redacted run passes, as the SDK checks it", () => {
    const fullRun = {
      id: "cm9zr4w9d000308l8c5n8xk7e",
      workflowId: WORKFLOW_ID,
      workspaceId: WORKSPACE_ID,
      workflowVersionId: null,
      status: "completed",
      isDryRun: true,
      triggerType: "webhook",
      surveyId: null,
      responseId: null,
      error: null,
      attempt: 0,
      createdAt: "2026-11-20T09:30:00.000Z",
      updatedAt: "2026-11-20T09:30:02.000Z",
      startedAt: "2026-11-20T09:30:01.000Z",
      finishedAt: "2026-11-20T09:30:02.000Z",
      triggerPayload: {
        type: "webhook",
        workspaceId: WORKSPACE_ID,
        workflowId: WORKFLOW_ID,
        triggeredAt: "2026-11-20T09:30:00.000Z",
        payload: { email: "ana@example.com" },
      },
      data: { steps: [] },
      logs: [
        {
          id: "cm9zr55mj000608l8g7r4cz2k",
          runId: "cm9zr4w9d000308l8c5n8xk7e",
          sequence: 0,
          stepId: "send-email",
          stepType: "send_email",
          status: "succeeded",
          input: {},
          output: { mocked: true },
          error: null,
          startedAt: "2026-11-20T09:30:01.000Z",
          finishedAt: "2026-11-20T09:30:02.000Z",
        },
      ],
      idempotencyKey: null,
      nextAttemptAt: null,
      lastErrorAt: null,
      callerIp: null,
      workflowVersionNumber: null,
      steps: [],
      contentDeletedAt: null,
      contentRetentionDays: null,
    };
    const outputSchema = createToolServer().get("run_test")!.config.outputSchema as {
      safeParse: (value: unknown) => { success: boolean; error?: unknown };
    };

    expect(outputSchema.safeParse({ data: fullRun }).error).toBeUndefined();
    expect(outputSchema.safeParse({ data: withoutRunRespondentData(fullRun) }).error).toBeUndefined();
  });

  test("tells the agent that payload values and responses are untrusted", () => {
    expect(createToolServer().get("run_test")?.config.description).toContain("untrusted");
  });
});
