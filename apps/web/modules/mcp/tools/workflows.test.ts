import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { toolResult, toolResultText } from "./__fixtures__/tool-result";
import { FULL_MCP_GRANT, type TToolHandler, elicitingOAuthContext } from "./test-utils";
import {
  buildListWorkflowRunsSearchParams,
  buildListWorkflowsSearchParams,
  registerWorkflowTools,
  withoutRespondentData,
  withoutRespondentDataInWorkflows,
} from "./workflows";

// The registered inputSchema is a Standard Schema; only these two members are read here.
type ZodObjectLike = { description?: string; safeParse: (value: unknown) => { success: boolean } };

// Asserted as a shape, not by calling getMcpResourceUrl() here: comparing production's value with
// itself would still pass if it regressed to the bare path "/api/mcp" — the ENG-2173 bug. The
// invariant that matters is that the audit apiUrl is absolute, because the audit schema validates it
// with z.url() and drops the whole event otherwise.
const ABSOLUTE_MCP_AUDIT_URL = expect.stringMatching(/^https?:\/\/[^/]+\/api\/mcp$/);

// vitestSetup stubs createHash, which the sealed confirmation state depends on.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@/app/api/v3/workflows/lib/context", () => ({
  buildWorkflowApiContext: vi.fn(() => ({ __ctx: true })),
  workflowsHandlers: {
    list: vi.fn(),
    get: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    testWorkflow: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    duplicate: vi.fn(),
    delete: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
  },
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const WORKSPACE_ID = "clxx1234567890123456789012";
const WORKFLOW_ID = "wf1234567890123456789012ab";
const RUN_ID = "run234567890123456789012ab";

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [
    { workspaceId: WORKSPACE_ID, workspaceName: "Workspace", permission: ApiKeyPermission.write },
  ],
};

// Full-scope token used by the behavior tests below.
const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["workflows:read", "workflows:write"],
  extra: { formbricksAuthentication: apiKeyAuth, requestId: "req_tool" },
};

// A write-capable user's OAuth token that was only granted read scope — the ENG-1967 case: workspace
// permissions would allow the write, but the token scope must not.
const readOnlyAuthInfo = {
  ...authInfo,
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["workflows:read"],
  extra: {
    requestId: "req_tool",
    authMethod: "oauth",
    grant: FULL_MCP_GRANT,
    formbricksAuthentication: {
      user: { id: "user_1", email: "person@example.com", name: "Person" },
      expires: "2026-07-01T00:00:00.000Z",
    },
  },
};
const noScopeAuthInfo = { ...readOnlyAuthInfo, scopes: [] as string[] };
/**
 * A session user's OAuth token (the grant applies; an API key has none) holding `responses:read`: what
 * Responses: Read decides on is then the grant alone.
 */
const sessionAuthInfo = {
  ...readOnlyAuthInfo,
  scopes: ["workflows:read", "responses:read"],
};
/** {@link sessionAuthInfo} under a grant at Workflow runs: Read and nothing of Responses. */
const runsOnlyGrantAuthInfo = {
  ...sessionAuthInfo,
  extra: { ...sessionAuthInfo.extra, grant: { access: "all", permissions: { workflowRuns: "read" } } },
};

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerWorkflowTools(server as unknown as Parameters<typeof registerWorkflowTools>[0]);
  return { server, tools };
}

describe("buildListWorkflowsSearchParams", () => {
  test("applies defensive defaults", () => {
    const params = buildListWorkflowsSearchParams({
      workspaceId: WORKSPACE_ID,
    } as unknown as Parameters<typeof buildListWorkflowsSearchParams>[0]);

    expect(params.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.get("limit")).toBe("20");
  });

  test("maps structured MCP filters to v3 query parameters", () => {
    const params = buildListWorkflowsSearchParams({
      workspaceId: WORKSPACE_ID,
      limit: 50,
      cursor: "cursor_1",
      sortBy: "name",
      filter: { name: { contains: "Onboarding" }, status: { in: ["draft", "disabled"] } },
    });

    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("filter[name][contains]")).toBe("Onboarding");
    expect(params.getAll("filter[status][in]")).toEqual(["draft", "disabled"]);
  });
});

describe("buildListWorkflowRunsSearchParams", () => {
  test("maps run filters including isDryRun to v3 query parameters", () => {
    const params = buildListWorkflowRunsSearchParams({
      workspaceId: WORKSPACE_ID,
      limit: 20,
      workflowId: WORKFLOW_ID,
      responseId: "resp234567890123456789012a",
      filter: { status: { in: ["completed"] }, isDryRun: false },
    });

    expect(params.get("workflowId")).toBe(WORKFLOW_ID);
    expect(params.get("responseId")).toBe("resp234567890123456789012a");
    expect(params.getAll("filter[status][in]")).toEqual(["completed"]);
    expect(params.get("filter[isDryRun][eq]")).toBe("false");
  });
});

describe("registerWorkflowTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as unknown as ReturnType<
      typeof buildWorkflowApiContext
    >);
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers all read + mutation tools with correct annotations", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(19);
    expect(tools.has("send_test_request")).toBe(true);
    expect(tools.has("set_expected_response")).toBe(true);
    expect(tools.has("run_test")).toBe(true);
    for (const name of [
      "list_workflows",
      "get_workflow",
      "list_workflow_runs",
      "get_workflow_run",
      "test_workflow",
    ]) {
      expect(tools.get(name)?.config).toMatchObject({
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      });
    }
    // Mutations are not read-only; patch/delete/enable are the destructive ones.
    expect(tools.get("create_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: false },
    });
    expect(tools.get("patch_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
    });
    expect(tools.get("delete_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
    });
    expect(tools.get("enable_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
    });
    expect(tools.get("disable_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: false },
    });
    // Archive soft-deletes (hidden from default reads) -> destructive; unarchive restores.
    expect(tools.get("archive_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
    });
    expect(tools.get("unarchive_workflow")?.config).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: false },
    });
  });

  test("list_workflows delegates to the handler with a synthetic query request", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.list).mockResolvedValue(
      successListResponse([{ id: WORKFLOW_ID }], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_workflows")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { http: { authInfo } });

    expect(buildWorkflowApiContext).toHaveBeenCalledWith(apiKeyAuth, "req_tool", "/api/mcp");
    const callArg = vi.mocked(workflowsHandlers.list).mock.calls[0][0];
    expect(callArg.ctx).toEqual({ __ctx: true });
    expect(new URL(callArg.req.url).searchParams.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(result.structuredContent).toEqual({
      data: [{ id: WORKFLOW_ID }],
      meta: { limit: 20, nextCursor: null },
      requestId: "req_tool",
    });
  });

  test("list_workflow_runs delegates to listRuns with a synthetic query request", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.listRuns).mockResolvedValue(
      successListResponse([{ id: RUN_ID }], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_workflow_runs")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20, workflowId: WORKFLOW_ID }, { http: { authInfo } });

    const callArg = vi.mocked(workflowsHandlers.listRuns).mock.calls[0][0];
    expect(callArg.ctx).toEqual({ __ctx: true });
    const params = new URL(callArg.req.url).searchParams;
    expect(params.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.get("workflowId")).toBe(WORKFLOW_ID);
    // This token has no responses:read, so each run's error is left out.
    expect(result.structuredContent).toEqual({
      data: [{ id: RUN_ID, error: null }],
      meta: { limit: 20, nextCursor: null },
      requestId: "req_tool",
    });
  });

  test("get_workflow delegates to the handler with params (no request)", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(workflowsHandlers.get).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(result.structuredContent).toEqual({ data: { id: WORKFLOW_ID }, requestId: "req_tool" });
  });

  test("get_workflow_run delegates to getRun with the run id", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.getRun).mockResolvedValue(
      successResponse({ id: RUN_ID }, { requestId: "req_tool" })
    );

    await tools.get("get_workflow_run")!.handler({ runId: RUN_ID }, { http: { authInfo } });

    expect(workflowsHandlers.getRun).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { runId: RUN_ID },
    });
  });

  describe("get_workflow_run respondent-derived fields", () => {
    // A failure's text can quote what a step sent: an SMTP rejection names the respondent's address.
    const run = {
      id: RUN_ID,
      status: "failed",
      error: "550 mailbox a@b.c unavailable",
      triggerPayload: { responseId: "resp_1", answers: { q1: "my email is a@b.c" } },
      data: { q1: "my email is a@b.c" },
      steps: [{ stepId: "s2", status: "failed", detail: { to: "a@b.c", subject: "Your answer" } }],
      logs: [
        { id: "log_1", stepId: "s1", status: "succeeded", input: { q1: "secret" }, output: { sent: true } },
        {
          id: "log_2",
          stepId: "s2",
          status: "failed",
          input: { to: "a@b.c" },
          output: null,
          error: "550 mailbox a@b.c unavailable",
        },
      ],
    };
    const redacted = {
      ...run,
      error: null,
      triggerPayload: null,
      data: null,
      steps: null,
      logs: [
        { id: "log_1", stepId: "s1", status: "succeeded", input: null, output: null, error: null },
        { id: "log_2", stepId: "s2", status: "failed", input: null, output: null, error: null },
      ],
    };
    const callWith = async (callerAuthInfo: unknown) => {
      const { tools } = createToolServer();
      vi.mocked(workflowsHandlers.getRun).mockResolvedValue(successResponse(run, { requestId: "req_tool" }));
      return tools
        .get("get_workflow_run")!
        .handler({ runId: RUN_ID }, { http: { authInfo: callerAuthInfo } });
    };
    test("keeps the tool for a grant without Responses: Read, leaving those fields out", async () => {
      // The token holds responses:read: only the grant can leave them out.
      const result = await callWith(runsOnlyGrantAuthInfo);

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ data: redacted, requestId: "req_tool" });
      expect(JSON.parse(result.content[0].text)).toEqual({ data: redacted, requestId: "req_tool" });
    });

    test("leaves them out when the grant gives Responses: Read but the token lacks responses:read", async () => {
      const result = await callWith(readOnlyAuthInfo);

      expect(result.structuredContent).toEqual({ data: redacted, requestId: "req_tool" });
    });

    test("returns them whole when both the token and the grant give Responses: Read", async () => {
      const result = await callWith(sessionAuthInfo);

      expect(result.structuredContent).toEqual({ data: run, requestId: "req_tool" });
    });

    test("returns them whole to an API key holding responses:read, which has no grant", async () => {
      const result = await callWith({ ...authInfo, scopes: ["workflows:read", "responses:read"] });

      expect(result.structuredContent).toEqual({ data: run, requestId: "req_tool" });
    });

    test("passes an error through untouched", async () => {
      const { tools } = createToolServer();
      vi.mocked(workflowsHandlers.getRun).mockResolvedValue(
        problemForbidden("req_tool", "You are not authorized to access this resource")
      );

      const result = await tools
        .get("get_workflow_run")!
        .handler({ runId: RUN_ID }, { http: { authInfo: runsOnlyGrantAuthInfo } });

      expect(workflowsHandlers.getRun).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ error: { status: 403 } });
    });
  });

  test("test_workflow delegates to testWorkflow with the workflow id", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.testWorkflow).mockResolvedValue(
      successResponse({ ok: true, problems: [] }, { requestId: "req_tool" })
    );

    await tools.get("test_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(workflowsHandlers.testWorkflow).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
  });

  test("maps v3 problem responses to MCP tool errors without leaking existence", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      requestId: "req_forbidden",
    });
  });

  test("create_workflow sends a body request and queues a success audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.create).mockResolvedValue(
      createdResponse({ id: WORKFLOW_ID }, { requestId: "req_tool", location: "/wf" })
    );
    const body = { workspaceId: WORKSPACE_ID, name: "WF", definition: { nodes: [], edges: [] } };

    const result = await tools.get("create_workflow")!.handler(body, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    expect(buildWorkflowApiContext).toHaveBeenCalledWith(apiKeyAuth, "req_tool", "/api/mcp", auditLog);
    const callArg = vi.mocked(workflowsHandlers.create).mock.calls[0][0];
    expect(callArg.ctx).toEqual({ __ctx: true });
    expect(JSON.parse(await callArg.req.text())).toMatchObject({ workspaceId: WORKSPACE_ID, name: "WF" });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({ data: { id: WORKFLOW_ID }, requestId: "req_tool" });
  });

  test("enable_workflow delegates by id and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "enabled" }, { requestId: "req_tool" })
    );

    await tools.get("enable_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    expect(workflowsHandlers.enable).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("delete_workflow queues a deleted audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.delete).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    const result = await tools
      .get("delete_workflow")!
      .handler({ workflowId: WORKFLOW_ID, confirm: true }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "deleted", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    expect(auditLog.status).toBe("success");
    expect(result.structuredContent).toEqual({ requestId: "req_tool" });
  });

  test("a failed mutation marks the audit eventId and returns an error (no leak)", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools
      .get("enable_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(result.isError).toBe(true);
    // Audit defaults to "failure" (buildAuditLogBaseObject); only success flips it, so a failed
    // mutation is queued with failure status + the requestId as eventId.
    expect(auditLog).toMatchObject({ status: "failure", eventId: "req_tool" });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("a thrown mutation still queues the audit log and re-propagates the error", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    const boom = new Error("workflow operation exploded");
    vi.mocked(workflowsHandlers.create).mockRejectedValue(boom);
    const body = { workspaceId: WORKSPACE_ID, name: "WF", definition: { nodes: [], edges: [] } };

    // The shared runner must not swallow errors: it flags the audit eventId, queues it, then rethrows.
    await expect(tools.get("create_workflow")!.handler(body, { http: { authInfo } })).rejects.toThrow(boom);
    expect(auditLog).toMatchObject({ eventId: "req_tool" });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("a null audit log is tolerated (still queues, no crash)", async () => {
    const { tools } = createToolServer();
    // buildV3AuditLog can return null (auditing disabled); the runner must not dereference it.
    vi.mocked(buildV3AuditLog).mockReturnValue(null as unknown as ReturnType<typeof buildV3AuditLog>);
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "enabled" }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("enable_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(queueV3AuditLog).toHaveBeenCalledWith(null, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: WORKFLOW_ID, status: "enabled" },
      requestId: "req_tool",
    });
  });

  test("patch_workflow sends a body request with params and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.patch).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, name: "Renamed" }, { requestId: "req_tool" })
    );

    await tools
      .get("patch_workflow")!
      .handler({ workflowId: WORKFLOW_ID, data: { name: "Renamed" } }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    const callArg = vi.mocked(workflowsHandlers.patch).mock.calls[0][0];
    expect(callArg.params).toEqual({ workflowId: WORKFLOW_ID });
    expect(JSON.parse(await callArg.req.text())).toEqual({ name: "Renamed" });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("duplicate_workflow sends the optional name body and queues a created audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.duplicate).mockResolvedValue(
      createdResponse({ id: "wf2222222222222222222222ab" }, { requestId: "req_tool", location: "/wf" })
    );

    await tools
      .get("duplicate_workflow")!
      .handler({ workflowId: WORKFLOW_ID, name: "Copy" }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    const callArg = vi.mocked(workflowsHandlers.duplicate).mock.calls[0][0];
    expect(callArg.params).toEqual({ workflowId: WORKFLOW_ID });
    expect(JSON.parse(await callArg.req.text())).toEqual({ name: "Copy" });
    expect(auditLog.status).toBe("success");
  });

  test("archive_workflow delegates by id and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.archive).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "archived" }, { requestId: "req_tool" })
    );

    await tools.get("archive_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    expect(workflowsHandlers.archive).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
  });

  test("unarchive_workflow delegates by id and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: Partial<TV3AuditLog> = { status: "failure" };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.unarchive).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "draft" }, { requestId: "req_tool" })
    );

    await tools.get("unarchive_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", ABSOLUTE_MCP_AUDIT_URL);
    expect(workflowsHandlers.unarchive).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
  });
});

describe("save-time rules on MCP writes", () => {
  const surveyId = "cm9zr4q7i000108l84gozfggr";
  const email = (id: string) => ({
    id,
    type: "action",
    actionType: "send_email",
    config: {
      from: "noreply@example.com",
      to: "support@example.com",
      replyTo: [],
      subject: "Thanks",
      body: "Thanks.",
      attachResponseData: false,
    },
  });
  // 26 steps: over the limit of 25, which a workflow saved before the limit may still hold.
  const nodes = Array.from({ length: 26 }, (_, index) => email(`email-${index}`));
  const overLimit = {
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId, endingCardIds: [] },
    },
    nodes,
    edges: nodes.map((node, index) => ({
      id: `edge-${index}`,
      source: index === 0 ? "trigger" : `email-${index - 1}`,
      target: node.id,
    })),
    entryNodeId: "trigger",
  };

  test("create_workflow and patch_workflow refuse a definition over a save-time limit", () => {
    const { tools } = createToolServer();
    const create = tools.get("create_workflow")!.config.inputSchema as z.ZodType;
    const patch = tools.get("patch_workflow")!.config.inputSchema as z.ZodType;

    const created = create.safeParse({ workspaceId: WORKSPACE_ID, name: "WF", definition: overLimit });
    const patched = patch.safeParse({ workflowId: WORKFLOW_ID, data: { definition: overLimit } });

    expect(created.success).toBe(false);
    expect(JSON.stringify(created.error?.issues)).toMatch(/at most 25 steps/);
    expect(patched.success).toBe(false);
    expect(JSON.stringify(patched.error?.issues)).toMatch(/at most 25 steps/);
  });
});

describe("MCP scope enforcement (ENG-1967)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as unknown as ReturnType<
      typeof buildWorkflowApiContext
    >);
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  // The detail names the scope the denied call needed, so each case asserts its own — a regression that
  // dropped or mislabelled the scope would slip past a generic prefix match.
  const insufficientScope = (scope: string) => ({
    status: 403,
    code: "forbidden",
    detail: expect.stringContaining(`its OAuth token lacks the scope ${scope}.`),
  });

  // Every mutating tool + a representative valid input for it.
  const writeTools: { name: string; handlerKey: keyof typeof workflowsHandlers; input: unknown }[] = [
    {
      name: "create_workflow",
      handlerKey: "create",
      input: { workspaceId: WORKSPACE_ID, name: "WF", definition: { nodes: [], edges: [] } },
    },
    { name: "patch_workflow", handlerKey: "patch", input: { workflowId: WORKFLOW_ID, data: { name: "x" } } },
    { name: "duplicate_workflow", handlerKey: "duplicate", input: { workflowId: WORKFLOW_ID } },
    { name: "delete_workflow", handlerKey: "delete", input: { workflowId: WORKFLOW_ID } },
    { name: "enable_workflow", handlerKey: "enable", input: { workflowId: WORKFLOW_ID } },
    { name: "disable_workflow", handlerKey: "disable", input: { workflowId: WORKFLOW_ID } },
    { name: "archive_workflow", handlerKey: "archive", input: { workflowId: WORKFLOW_ID } },
    { name: "unarchive_workflow", handlerKey: "unarchive", input: { workflowId: WORKFLOW_ID } },
  ];

  test.each(writeTools)(
    "$name is denied for a read-scoped token before the mutation runs",
    async ({ name, handlerKey, input }) => {
      const { tools } = createToolServer();

      const result = await tools.get(name)!.handler(input, { http: { authInfo: readOnlyAuthInfo } });

      // The mutation never runs, and no audit log is queued for a request that was blocked at the gate.
      expect(workflowsHandlers[handlerKey]).not.toHaveBeenCalled();
      expect(queueV3AuditLog).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        ...insufficientScope("workflows:write"),
        requestId: "req_tool",
      });
    }
  );

  test("write tools succeed once the token carries workflows:write", async () => {
    const { tools } = createToolServer();
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "enabled" }, { requestId: "req_tool" })
    );

    await tools.get("enable_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });

    expect(workflowsHandlers.enable).toHaveBeenCalledTimes(1);
  });

  test("read tools require workflows:read", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("list_workflows")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { http: { authInfo: noScopeAuthInfo } });

    expect(workflowsHandlers.list).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      ...insufficientScope("workflows:read"),
      requestId: "req_tool",
    });
  });

  test("read tools succeed for a read-only token", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.list).mockResolvedValue(
      successListResponse([{ id: WORKFLOW_ID }], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );

    await tools
      .get("list_workflows")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { http: { authInfo: readOnlyAuthInfo } });

    expect(workflowsHandlers.list).toHaveBeenCalledTimes(1);
  });
});

/**
 * A create_workflow payload that passes the v3 contract in full — cuid2 ids, a trigger, and a graph whose
 * single edge connects the trigger to a real action node. Needed so a strictness assertion can isolate the
 * unknown key as the only reason for rejection.
 */
const VALID_CREATE_WORKFLOW_INPUT = {
  workspaceId: "cm9zr4mps000008l8btfy1vtz",
  name: "Notify team",
  definition: {
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "cm9zr4q7i000108l84gozfggr", endingCardIds: [] },
    },
    nodes: [
      {
        id: "send-email",
        type: "action",
        actionType: "send_email",
        config: {
          from: "noreply@example.com",
          to: "support@example.com",
          replyTo: ["support@example.com"],
          subject: "Thanks",
          body: "Thanks for your response.",
          attachResponseData: true,
        },
      },
    ],
    edges: [{ id: "e1", source: "trigger", target: "send-email" }],
    entryNodeId: "trigger",
  },
};

describe("create_workflow advertised input schema", () => {
  /**
   * `ZMcpCreateWorkflowInput` is the one MCP schema that deliberately does NOT append `.strict()`: its
   * base (`ZCreateWorkflowInput`) is already a `z.strictObject`, and Zod 4's `.strict()` returns a clone
   * that drops `.describe()`. Appending it for consistency with the sibling schemas would keep validation
   * identical while silently deleting the contract's own description from `tools/list` — a loss nothing
   * else here would catch, since a strictness assertion passes either way.
   */
  test("carries the contract description and still rejects unknown keys", () => {
    const { tools } = createToolServer();
    const schema = tools.get("create_workflow")!.config.inputSchema as ZodObjectLike;

    expect(schema.description).toBe("Creates a draft workflow.");

    // A fully valid payload first, so the rejection below can only be caused by the unknown key. An
    // earlier version passed `{ workspaceId: "abc", name: "x", definition: {} }` — three separate
    // validation failures — and so would have passed with strictness removed entirely.
    expect(schema.safeParse(VALID_CREATE_WORKFLOW_INPUT).success).toBe(true);
    expect(schema.safeParse({ ...VALID_CREATE_WORKFLOW_INPUT, bogus: 1 }).success).toBe(false);
  });
});

describe("delete_workflow confirmation", () => {
  const input = { workflowId: WORKFLOW_ID };

  test("asks the user instead of deleting when called without confirm", async () => {
    const { tools } = createToolServer();

    const result = (await tools.get("delete_workflow")!.handler(input, { http: { authInfo } })) as Record<
      string,
      unknown
    >;

    expect(result.resultType).toBe("input_required");
    expect(workflowsHandlers.delete).not.toHaveBeenCalled();
  });

  test("a model-asserted confirm does not delete when the client can ask the user", async () => {
    const { tools } = createToolServer();

    const result = (await tools
      .get("delete_workflow")!
      .handler({ ...input, confirm: true }, elicitingOAuthContext(authInfo))) as Record<string, unknown>;

    expect(result.resultType).toBe("input_required");
    expect(workflowsHandlers.delete).not.toHaveBeenCalled();
  });
});

describe("a Switch step through MCP (ENG-7157)", () => {
  const routing = (caseCount: number) => {
    const [emailNode] = VALID_CREATE_WORKFLOW_INPUT.definition.nodes;
    const cases = Array.from({ length: caseCount }, (_, index) => ({
      id: `case-${index}`,
      name: `Case ${index + 1}`,
      operator: "equals",
      right: `tier-${index}`,
    }));
    return {
      ...VALID_CREATE_WORKFLOW_INPUT.definition,
      nodes: [
        { id: "route", type: "switch", config: { left: { path: "response.tier" }, cases } },
        { ...emailNode, id: "first-case-email" },
      ],
      edges: [
        { id: "e1", source: VALID_CREATE_WORKFLOW_INPUT.definition.trigger.id, target: "route" },
        { id: "e2", source: "route", target: "first-case-email", sourceHandle: "case-0" },
      ],
    };
  };

  test("create_workflow and patch_workflow take a Switch with 2 to 10 cases", () => {
    const { tools } = createToolServer();
    const create = tools.get("create_workflow")!.config.inputSchema as z.ZodType;
    const patch = tools.get("patch_workflow")!.config.inputSchema as z.ZodType;

    expect(create.safeParse({ ...VALID_CREATE_WORKFLOW_INPUT, definition: routing(10) }).success).toBe(true);
    expect(patch.safeParse({ workflowId: WORKFLOW_ID, data: { definition: routing(2) } }).success).toBe(true);
    const overLimit = create.safeParse({ ...VALID_CREATE_WORKFLOW_INPUT, definition: routing(11) });
    expect(JSON.stringify(overLimit.error?.issues)).toMatch(/at most 10 cases/);
  });
});

describe("create_workflow save-time limits (ENG-7176)", () => {
  test("refuses a definition with more than 25 steps before it reaches the handler", () => {
    const { tools } = createToolServer();
    const schema = tools.get("create_workflow")!.config.inputSchema as ZodObjectLike;
    const [emailNode] = VALID_CREATE_WORKFLOW_INPUT.definition.nodes;
    const nodes = Array.from({ length: 26 }, (_, index) => ({ ...emailNode, id: `email-${index}` }));
    const edges = nodes.map((node, index) => ({
      id: `edge-${index}`,
      source: index === 0 ? "trigger" : `email-${index - 1}`,
      target: node.id,
    }));
    const definition = { ...VALID_CREATE_WORKFLOW_INPUT.definition, nodes, edges };

    expect(schema.safeParse({ ...VALID_CREATE_WORKFLOW_INPUT, definition }).success).toBe(false);
    expect(
      schema.safeParse({
        ...VALID_CREATE_WORKFLOW_INPUT,
        definition: { ...definition, nodes: nodes.slice(0, 25), edges: edges.slice(0, 25) },
      }).success
    ).toBe(true);
  });
});

describe("list_workflow_runs without Responses: Read", () => {
  const runs = [
    { id: "run_1", status: "failed", responseId: "resp_1", error: "550 mailbox a@b.c unavailable" },
    { id: "run_2", status: "succeeded", responseId: "resp_2", error: null },
  ];
  const callWith = async (callerAuthInfo: unknown) => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.listRuns).mockResolvedValue(
      successListResponse(runs, { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );
    return tools
      .get("list_workflow_runs")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { http: { authInfo: callerAuthInfo } });
  };

  // A run's error text can quote what a failed step sent, as `get_workflow_run` leaves out.
  test("leaves each run's error out for a grant without Responses: Read", async () => {
    // The token holds responses:read: only the grant can leave the errors out.
    const result = await callWith(runsOnlyGrantAuthInfo);

    const redacted = runs.map((run) => ({ ...run, error: null }));
    expect((result.structuredContent as { data: unknown }).data).toEqual(redacted);
    expect(JSON.parse(result.content[0].text).data).toEqual(redacted);
  });

  test("returns each run's error when both the token and the grant give Responses: Read", async () => {
    const result = await callWith(sessionAuthInfo);

    expect((result.structuredContent as { data: unknown }).data).toEqual(runs);
  });
});

/**
 * A workflow embeds its latest run, whose error can quote what a failed step sent — the same leak
 * `get_workflow_run` closes, reached through a tool that declares only Workflows.
 */
describe("workflow lastRun without Responses: Read", () => {
  const workflow = {
    id: WORKFLOW_ID,
    name: "Notify",
    status: "enabled",
    lastRun: { id: RUN_ID, status: "failed", error: "550 mailbox a@b.c unavailable" },
  };
  const redacted = { ...workflow, lastRun: { ...workflow.lastRun, error: null } };
  const other = { id: "wf9999999999999999999999ab", name: "Other", lastRun: null };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as unknown as ReturnType<
      typeof buildWorkflowApiContext
    >);
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
    vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as unknown as TV3AuditLog);
  });

  // A session user's token holding `responses:read`, under a grant at Workflows and Workflow runs: Read
  // and nothing of Responses: the grant alone leaves the error out.
  const workflowsOnly = {
    ...sessionAuthInfo,
    extra: {
      ...sessionAuthInfo.extra,
      grant: { access: "all", permissions: { workflows: "read", workflowRuns: "read" } },
    },
  };

  test("get_workflow sets lastRun.error to null for a grant without Responses: Read", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(successResponse(workflow, { requestId: "req_tool" }));

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: workflowsOnly } });

    expect(result.structuredContent).toEqual({ data: redacted, requestId: "req_tool" });
    expect(JSON.parse(result.content[0].text)).toEqual({ data: redacted, requestId: "req_tool" });
  });

  test("list_workflows sets each lastRun.error to null, leaving a workflow without a run alone", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.list).mockResolvedValue(
      successListResponse([workflow, other], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_workflows")!
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { http: { authInfo: workflowsOnly } });

    expect((result.structuredContent as { data: unknown }).data).toEqual([redacted, other]);
    expect(JSON.parse(result.content[0].text).data).toEqual([redacted, other]);
  });

  test("a mutation's workflow keeps lastRun.error only for a caller with Responses: Read", async () => {
    const { tools } = createToolServer();
    const caller = (authInfo: unknown) =>
      tools.get("enable_workflow")!.handler({ workflowId: WORKFLOW_ID }, { http: { authInfo } });
    // A fresh Response per call: a body can only be read once.
    vi.mocked(workflowsHandlers.enable).mockImplementation(async () =>
      successResponse(workflow, { requestId: "req_tool" })
    );

    expect((await caller(authInfo)).structuredContent).toEqual({ data: redacted, requestId: "req_tool" });
    expect(
      (await caller({ ...authInfo, scopes: ["workflows:read", "workflows:write", "responses:read"] }))
        .structuredContent
    ).toEqual({ data: workflow, requestId: "req_tool" });
  });

  test("returns the workflow whole when both the token and the grant give Responses: Read", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(successResponse(workflow, { requestId: "req_tool" }));

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: sessionAuthInfo } });

    expect(result.structuredContent).toEqual({ data: workflow, requestId: "req_tool" });
  });

  test("passes an error through untouched", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      problemForbidden("req_tool", "You are not authorized to access this resource")
    );

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: workflowsOnly } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { status: 403 } });
    // The operation's refusal, not the guard's: the grant reaches the tool.
    expect(workflowsHandlers.get).toHaveBeenCalledTimes(1);
  });

  // The grant is what lets these tools run at all: without Workflows: Read they are refused before the
  // handler, so the tests above exercise the redaction rather than a guard refusal.
  test("refuses a grant without Workflows: Read before the handler", async () => {
    const { tools } = createToolServer();
    const noWorkflows = {
      ...workflowsOnly,
      extra: { ...workflowsOnly.extra, grant: { access: "all", permissions: { workflowRuns: "read" } } },
    };

    const result = await tools
      .get("get_workflow")!
      .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: noWorkflows } });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain("Workflows: Read");
    expect(workflowsHandlers.get).not.toHaveBeenCalled();
  });
});

describe("withoutRespondentDataInWorkflows", () => {
  test("leaves a result that carries no workflow as it is", () => {
    const empty = toolResult({ requestId: "r" });
    expect(withoutRespondentDataInWorkflows(empty as never)).toBe(empty);
    const listed = toolResult({ data: [1, 2], requestId: "r" });
    expect(withoutRespondentDataInWorkflows(listed as never)).toBe(listed);
  });

  test("redacts the single-workflow and list shapes, leaving other fields and shapes alone", () => {
    const single = withoutRespondentDataInWorkflows(
      toolResult({
        data: { id: "w", name: "n", lastRun: { status: "failed", error: "550 a@b.c" } },
        requestId: "r",
      })
    );
    expect(single.structuredContent).toEqual({
      data: { id: "w", name: "n", lastRun: { status: "failed", error: null } },
      requestId: "r",
    });
    expect(toolResultText(single)).toEqual(single.structuredContent);

    const list = withoutRespondentDataInWorkflows(
      toolResult({
        data: [
          { id: "w", lastRun: { error: "x" } },
          { id: "v", lastRun: null },
        ],
        requestId: "r",
      })
    );
    expect(list.structuredContent).toEqual({
      data: [
        { id: "w", lastRun: { error: null } },
        { id: "v", lastRun: null },
      ],
      requestId: "r",
    });
  });

  test("passes an error result through untouched", () => {
    const error = { isError: true, structuredContent: { data: { lastRun: { error: "x" } } }, content: [] };
    expect(withoutRespondentDataInWorkflows(error as never)).toBe(error);
  });
});

describe("withoutRespondentData", () => {
  test("leaves a result without a run object as it is", () => {
    const empty = toolResult({ requestId: "r" });
    expect(withoutRespondentData(empty as never)).toBe(empty);
    const listed = toolResult({ data: [1, 2], requestId: "r" });
    expect(withoutRespondentData(listed as never)).toBe(listed);
  });

  test("keeps logs it can't read as they are, and a queued run's missing logs", () => {
    const result = withoutRespondentData(toolResult({ data: { logs: ["odd"], data: { a: 1 } } }));
    expect(result.structuredContent).toEqual({
      data: { logs: ["odd"], data: null, triggerPayload: null, error: null },
    });
    const queued = withoutRespondentData(toolResult({ data: { triggerPayload: { a: 1 } } }));
    expect(queued.structuredContent).toEqual({
      data: { triggerPayload: null, data: null, logs: undefined, error: null },
    });
  });
});
