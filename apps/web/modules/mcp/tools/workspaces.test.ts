import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successListResponse, successResponse } from "@/app/api/v3/lib/response";
import { getV3WorkspaceCustomCss, patchV3WorkspaceCustomCss } from "@/app/api/v3/workspaces/lib/custom-css";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { ZMcpPatchWorkspaceCustomCssInput } from "./schemas";
import { ZMcpWorkspaceCustomCssOutput, registerWorkspaceTools } from "./workspaces";

vi.mock("@/app/api/v3/workspaces/lib/operations", () => ({
  listV3Workspaces: vi.fn(),
}));

vi.mock("@/app/api/v3/workspaces/lib/custom-css", () => ({
  getV3WorkspaceCustomCss: vi.fn(),
  patchV3WorkspaceCustomCss: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const oauthSession = {
  user: { id: "user_1", email: "person@example.com", name: "Person" },
  expires: "2026-07-01T00:00:00.000Z",
};

const readAuthInfo = {
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["surveys:read"],
  extra: { formbricksAuthentication: oauthSession, requestId: "req_tool", authMethod: "oauth" },
};

const writeOnlyAuthInfo = { ...readAuthInfo, scopes: ["surveys:write"] };
const feedbackReadAuthInfo = { ...readAuthInfo, scopes: ["feedbackRecords:read"] };
const workflowReadAuthInfo = { ...readAuthInfo, scopes: ["workflows:read"] };

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
  registerWorkspaceTools(server as any);
  return { server, tools };
}

describe("registerWorkspaceTools", () => {
  beforeEach(() => vi.clearAllMocks());

  test("registers list_workspaces as a read-only tool", () => {
    const { tools } = createToolServer();
    const tool = tools.get("list_workspaces");
    expect(tool).toBeDefined();
    expect(tool!.config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  });

  test("calls the v3 list-workspaces operation and returns structured content", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Workspaces).mockResolvedValue(
      successListResponse(
        [{ id: "w1", name: "Alpha", organizationId: "org_1" }],
        { nextCursor: null, totalCount: 1 },
        { requestId: "req_tool" }
      )
    );

    const result = await tools.get("list_workspaces")!.handler({}, { http: { authInfo: readAuthInfo } });

    expect(listV3Workspaces).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: oauthSession,
        requestId: "req_tool",
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent).toEqual({
      data: [{ id: "w1", name: "Alpha", organizationId: "org_1" }],
      meta: { nextCursor: null, totalCount: 1 },
      requestId: "req_tool",
    });
  });

  test("returns an insufficient-scope error without any read scope (and skips the operation)", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("list_workspaces")!.handler({}, { http: { authInfo: writeOnlyAuthInfo } });

    expect(listV3Workspaces).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });

  // Workspace discovery is the prerequisite for the feedback-record tools too, so a token scoped only
  // to feedbackRecords:read must be able to resolve its workspaceId.
  test("allows a feedbackRecords-only token to discover workspaces", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Workspaces).mockResolvedValue(
      successListResponse([], { nextCursor: null, totalCount: 0 }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_workspaces")!
      .handler({}, { http: { authInfo: feedbackReadAuthInfo } });

    expect(listV3Workspaces).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });

  // Same for the workflow tools: auth.ts admits a token holding only workflows:read, so it must be
  // able to resolve the workspaceId every workflow tool requires.
  test("allows a workflows-only token to discover workspaces", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Workspaces).mockResolvedValue(
      successListResponse([], { nextCursor: null, totalCount: 0 }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("list_workspaces")!
      .handler({}, { http: { authInfo: workflowReadAuthInfo } });

    expect(listV3Workspaces).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });
});

describe("workspace custom CSS tools (ENG-3641)", () => {
  const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
  const resource = {
    workspaceId,
    customCss: { light: "a{}", dark: null },
    previous: null,
    status: "ok",
    canEdit: true,
    planAllowed: true,
  };
  const warning = {
    code: "import_removed",
    scope: "workspace",
    appearance: "light",
    line: 1,
    column: 1,
    reason: "@import is not supported",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildV3AuditLog).mockReturnValue({ status: "failure" } as never);
  });

  test("registers the narrow custom CSS tools beside workspace discovery", () => {
    const { tools } = createToolServer();

    expect([...tools.keys()]).toEqual([
      "list_workspaces",
      "get_workspace_custom_css",
      "patch_workspace_custom_css",
    ]);
    expect(tools.get("get_workspace_custom_css")!.config.annotations).toMatchObject({ readOnlyHint: true });
    expect(tools.get("patch_workspace_custom_css")!.config.annotations).toMatchObject({
      readOnlyHint: false,
    });
    expect(tools.get("get_workspace_custom_css")!.config.outputSchema).toBe(ZMcpWorkspaceCustomCssOutput);
  });

  test("get_workspace_custom_css reads through the v3 operation with surveys:read", async () => {
    vi.mocked(getV3WorkspaceCustomCss).mockResolvedValue(
      successResponse(resource, { requestId: "req_tool" })
    );
    const { tools } = createToolServer();

    const result = await tools
      .get("get_workspace_custom_css")!
      .handler({ workspaceId }, { http: { authInfo: readAuthInfo } });

    expect(getV3WorkspaceCustomCss).toHaveBeenCalledWith({
      workspaceId,
      authentication: oauthSession,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(result.structuredContent).toEqual({ data: resource, requestId: "req_tool" });
    expect(ZMcpWorkspaceCustomCssOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("get_workspace_custom_css refuses a token without surveys:read", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("get_workspace_custom_css")!
      .handler({ workspaceId }, { http: { authInfo: writeOnlyAuthInfo } });

    expect(getV3WorkspaceCustomCss).not.toHaveBeenCalled();
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });

  test("patch_workspace_custom_css saves through the v3 operation, audited, and relays the warnings", async () => {
    vi.mocked(patchV3WorkspaceCustomCss).mockResolvedValue(
      successResponse(resource, { requestId: "req_tool", extensions: { warnings: [warning] } })
    );
    const { tools } = createToolServer();

    const result = await tools
      .get("patch_workspace_custom_css")!
      .handler(
        { workspaceId, customCss: { light: "a{}", dark: null } },
        { http: { authInfo: writeOnlyAuthInfo } }
      );

    expect(patchV3WorkspaceCustomCss).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        body: { customCss: { light: "a{}", dark: null } },
        authentication: oauthSession,
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent).toEqual({ data: resource, warnings: [warning], requestId: "req_tool" });
    expect(ZMcpWorkspaceCustomCssOutput.safeParse(result.structuredContent).success).toBe(true);
    expect(buildV3AuditLog).toHaveBeenCalledWith(oauthSession, "updated", "workspace", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("patch_workspace_custom_css refuses a read-only token and records the refused attempt", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("patch_workspace_custom_css")!
      .handler({ workspaceId, customCss: null }, { http: { authInfo: readAuthInfo } });

    expect(patchV3WorkspaceCustomCss).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(queueV3AuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: workspaceId }),
      "req_tool",
      expect.anything()
    );
  });

  test("the operation's own refusal (a member, not an owner or manager) comes back as a structured error", async () => {
    vi.mocked(patchV3WorkspaceCustomCss).mockResolvedValue(
      problemForbidden(
        "req_tool",
        "Only organization owners and managers can change workspace custom CSS.",
        "/api/mcp"
      )
    );
    const { tools } = createToolServer();

    const result = await tools
      .get("patch_workspace_custom_css")!
      .handler({ workspaceId, customCss: null }, { http: { authInfo: writeOnlyAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, code: "forbidden" });
  });

  test("the input schema is strict and source-only", () => {
    expect(ZMcpPatchWorkspaceCustomCssInput.safeParse({ workspaceId, customCss: null }).success).toBe(true);
    for (const input of [
      { workspaceId, customCss: { light: "a{}", dark: null, compiled: "x" } },
      { workspaceId, customCss: { light: "a{}" } },
      { workspaceId },
      { workspaceId, customCss: null, organizationId: "org_1" },
    ]) {
      expect(ZMcpPatchWorkspaceCustomCssInput.safeParse(input).success).toBe(false);
    }
  });
});
