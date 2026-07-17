import { beforeEach, describe, expect, test, vi } from "vitest";
import { successListResponse } from "@/app/api/v3/lib/response";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { registerWorkspaceTools } from "./workspaces";

vi.mock("@/app/api/v3/workspaces/lib/operations", () => ({
  listV3Workspaces: vi.fn(),
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
        { limit: 500, nextCursor: null, totalCount: 1 },
        { requestId: "req_tool" }
      )
    );

    const result = await tools.get("list_workspaces")!.handler({}, { authInfo: readAuthInfo });

    expect(listV3Workspaces).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: oauthSession,
        requestId: "req_tool",
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent).toEqual({
      data: [{ id: "w1", name: "Alpha", organizationId: "org_1" }],
      meta: { limit: 500, nextCursor: null, totalCount: 1 },
      requestId: "req_tool",
    });
  });

  test("returns an insufficient-scope error without surveys:read (and skips the operation)", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("list_workspaces")!.handler({}, { authInfo: writeOnlyAuthInfo });

    expect(listV3Workspaces).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });
});
