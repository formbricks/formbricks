import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import {
  buildListWorkflowRunsSearchParams,
  buildListWorkflowsSearchParams,
  registerWorkflowTools,
} from "./workflows";

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
    { workspaceId: WORKSPACE_ID, workspaceName: "Workspace", permission: ApiKeyPermission.read },
  ],
};

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["workflows:read"],
  extra: { formbricksAuthentication: apiKeyAuth, requestId: "req_tool" },
};

function createToolServer() {
  const tools = new Map<
    string,
    { config: Record<string, unknown>; handler: (input: any, extra: any) => Promise<any> }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };
  registerWorkflowTools(server as any);
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
    vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as any);
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers all read + mutation tools with correct annotations", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(13);
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
      .handler({ workspaceId: WORKSPACE_ID, limit: 20 }, { authInfo });

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
      .handler({ workspaceId: WORKSPACE_ID, limit: 20, workflowId: WORKFLOW_ID }, { authInfo });

    const callArg = vi.mocked(workflowsHandlers.listRuns).mock.calls[0][0];
    expect(callArg.ctx).toEqual({ __ctx: true });
    const params = new URL(callArg.req.url).searchParams;
    expect(params.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.get("workflowId")).toBe(WORKFLOW_ID);
    expect(result.structuredContent).toEqual({
      data: [{ id: RUN_ID }],
      meta: { limit: 20, nextCursor: null },
      requestId: "req_tool",
    });
  });

  test("get_workflow delegates to the handler with params (no request)", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID }, { requestId: "req_tool" })
    );

    const result = await tools.get("get_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

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

    await tools.get("get_workflow_run")!.handler({ runId: RUN_ID }, { authInfo });

    expect(workflowsHandlers.getRun).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { runId: RUN_ID },
    });
  });

  test("test_workflow delegates to testWorkflow with the workflow id", async () => {
    const { tools } = createToolServer();
    vi.mocked(workflowsHandlers.testWorkflow).mockResolvedValue(
      successResponse({ ok: true, problems: [] }, { requestId: "req_tool" })
    );

    await tools.get("test_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

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

    const result = await tools.get("get_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      requestId: "req_forbidden",
    });
  });

  test("create_workflow sends a body request and queues a success audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.create).mockResolvedValue(
      createdResponse({ id: WORKFLOW_ID }, { requestId: "req_tool", location: "/wf" })
    );
    const body = { workspaceId: WORKSPACE_ID, name: "WF", definition: { nodes: [], edges: [] } };

    const result = await tools.get("create_workflow")!.handler(body, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "workflow", "/api/mcp");
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
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "enabled" }, { requestId: "req_tool" })
    );

    await tools.get("enable_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", "/api/mcp");
    expect(workflowsHandlers.enable).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("delete_workflow queues a deleted audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.delete).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    const result = await tools.get("delete_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "deleted", "workflow", "/api/mcp");
    expect(auditLog.status).toBe("success");
    expect(result.structuredContent).toEqual({ requestId: "req_tool" });
  });

  test("a failed mutation marks the audit eventId and returns an error (no leak)", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.enable).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools.get("enable_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(result.isError).toBe(true);
    // Audit defaults to "failure" (buildAuditLogBaseObject); only success flips it, so a failed
    // mutation is queued with failure status + the requestId as eventId.
    expect(auditLog).toMatchObject({ status: "failure", eventId: "req_tool" });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("patch_workflow sends a body request with params and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.patch).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, name: "Renamed" }, { requestId: "req_tool" })
    );

    await tools
      .get("patch_workflow")!
      .handler({ workflowId: WORKFLOW_ID, data: { name: "Renamed" } }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", "/api/mcp");
    const callArg = vi.mocked(workflowsHandlers.patch).mock.calls[0][0];
    expect(callArg.params).toEqual({ workflowId: WORKFLOW_ID });
    expect(JSON.parse(await callArg.req.text())).toEqual({ name: "Renamed" });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("duplicate_workflow sends the optional name body and queues a created audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.duplicate).mockResolvedValue(
      createdResponse({ id: "wf2222222222222222222222ab" }, { requestId: "req_tool", location: "/wf" })
    );

    await tools.get("duplicate_workflow")!.handler({ workflowId: WORKFLOW_ID, name: "Copy" }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "workflow", "/api/mcp");
    const callArg = vi.mocked(workflowsHandlers.duplicate).mock.calls[0][0];
    expect(callArg.params).toEqual({ workflowId: WORKFLOW_ID });
    expect(JSON.parse(await callArg.req.text())).toEqual({ name: "Copy" });
    expect(auditLog.status).toBe("success");
  });

  test("archive_workflow delegates by id and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.archive).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "archived" }, { requestId: "req_tool" })
    );

    await tools.get("archive_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", "/api/mcp");
    expect(workflowsHandlers.archive).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
  });

  test("unarchive_workflow delegates by id and queues an updated audit log", async () => {
    const { tools } = createToolServer();
    const auditLog: any = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(workflowsHandlers.unarchive).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID, status: "draft" }, { requestId: "req_tool" })
    );

    await tools.get("unarchive_workflow")!.handler({ workflowId: WORKFLOW_ID }, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "workflow", "/api/mcp");
    expect(workflowsHandlers.unarchive).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(auditLog.status).toBe("success");
  });
});
