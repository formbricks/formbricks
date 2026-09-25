import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { registerScopedTool } from "./guard-scopes";

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn(),
}));
vi.mock("@/modules/auth/lib/oauth-urls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/oauth-urls")>()),
  getMcpResourceUrl: () => "https://app.test/api/mcp",
}));

// The insufficient-scope shape the guard puts on structuredContent — narrowed from `unknown`.
type ScopeErrorContent = {
  error: { status: number; code: string; detail: string; requestId: string };
};

// A minimal stand-in for McpServer that captures what registerScopedTool registers.
function createToolServer() {
  const tools = new Map<
    string,
    { config: Record<string, unknown>; handler: (input: unknown, extra: unknown) => Promise<CallToolResult> }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };
  return { server, tools };
}

/** An API-key principal as `authenticateMcpRequest` attaches it — what `getMcpAuthentication` reads. */
const API_KEY_AUTH = { apiKeyId: "key_ro", organizationId: "org_1", workspacePermissions: [] };

function authInfoWithScopes(scopes: string[], requestId = "req_guard", authentication?: unknown): AuthInfo {
  return {
    token: "tok",
    clientId: "client",
    scopes,
    extra: { requestId, ...(authentication ? { formbricksAuthentication: authentication } : {}) },
  } as unknown as AuthInfo;
}

const CONFIG = {
  title: "Do thing",
  description: "A guarded tool",
  annotations: { readOnlyHint: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mirrors the real builder's one branch that matters here: no principal, no event.
  vi.mocked(buildV3AuditLog).mockImplementation(((
    authentication: unknown,
    action: string,
    targetType: string
  ) => (authentication ? { action, targetType, status: "failure" } : undefined)) as never);
  vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
});

describe("registerScopedTool", () => {
  test("registers the tool under its name with the config untouched", () => {
    const { server, tools } = createToolServer();

    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:write"], vi.fn() as any);

    expect(server.registerTool).toHaveBeenCalledTimes(1);
    expect(server.registerTool.mock.calls[0][0]).toBe("do_thing");
    expect(tools.get("do_thing")?.config).toBe(CONFIG);
  });

  test("runs the handler and returns its result when the token holds every required scope", async () => {
    const { server, tools } = createToolServer();
    const handlerResult = { structuredContent: { ok: true } } as unknown as CallToolResult;
    const handler = vi.fn().mockResolvedValue(handlerResult);
    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:read", "surveys:write"], handler as any);

    const input = { a: 1 };
    const ctx = { http: { authInfo: authInfoWithScopes(["surveys:read", "surveys:write"]) } };
    const result = await tools.get("do_thing")!.handler(input, ctx);

    expect(handler).toHaveBeenCalledWith(input, ctx);
    expect(result).toBe(handlerResult);
  });

  test("blocks the handler with a 403 insufficient-scope result when a required scope is missing", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:write"], handler as any);

    const result = await tools
      .get("do_thing")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["surveys:read"], "req_denied") } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.structuredContent as ScopeErrorContent).error).toMatchObject({
      status: 403,
      code: "forbidden",
      // The missing scope must be in the body: this result reaches the client as a JSON-RPC payload
      // with no headers, so the WWW-Authenticate challenge cannot tell it what to re-authorize for.
      detail: "OAuth token does not include the required MCP scope: surveys:write",
      requestId: "req_denied",
    });
  });

  test("denies when the token holds only some of several required scopes", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:read", "surveys:write"], handler as any);

    const result = await tools
      .get("do_thing")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["surveys:read"]) } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // Every required scope is listed, not just the first one that failed.
    expect((result.structuredContent as ScopeErrorContent).error.detail).toContain(
      "surveys:read surveys:write"
    );
  });
});

/**
 * ENG-2872. The gate runs before the tool's own audit runner, so a read-only credential reaching for a
 * mutation used to leave no trace — the one attempt an audit trail exists to show. These pin that a
 * refused mutation is written down as a failure attributed to the caller, and that nothing else is.
 */
describe("registerScopedTool — auditing refused mutations", () => {
  const AUDITED = {
    ...CONFIG,
    audit: { action: "deleted", targetType: "response", targetIdArg: "responseId" },
  } as const;

  test("audits a refused mutation as a failed attempt by the actor, against the id it named", async () => {
    const { server, tools } = createToolServer();
    registerScopedTool(server as any, "delete_response", AUDITED, ["responses:write"], vi.fn() as any);

    const result = await tools
      .get("delete_response")!
      .handler(
        { responseId: "clres00000000000000000001", confirm: true },
        { http: { authInfo: authInfoWithScopes(["responses:read"], "req_probe", API_KEY_AUTH) } }
      );

    expect(result.isError).toBe(true);
    expect(buildV3AuditLog).toHaveBeenCalledWith(
      API_KEY_AUTH,
      "deleted",
      "response",
      "https://app.test/api/mcp"
    );
    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queueV3AuditLog).mock.calls[0][0]).toMatchObject({
      status: "failure",
      eventId: "req_probe",
      targetId: "clres00000000000000000001",
    });
  });

  test("records no target for a refused creation, even when the input names an existing id", async () => {
    const { server, tools } = createToolServer();
    const created = { ...CONFIG, audit: { action: "created", targetType: "workflow" } } as const;
    registerScopedTool(server as any, "duplicate_workflow", created, ["workflows:write"], vi.fn() as any);

    await tools
      .get("duplicate_workflow")!
      .handler(
        { workflowId: "clwf000000000000000000001" },
        { http: { authInfo: authInfoWithScopes(["workflows:read"], "req_dup", API_KEY_AUTH) } }
      );

    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
    // The id in the input is the source being copied, not something that was created.
    expect(vi.mocked(queueV3AuditLog).mock.calls[0][0]).not.toHaveProperty("targetId");
  });

  test("audits nothing when the refused tool declares no audit — reads are not attempts", async () => {
    const { server, tools } = createToolServer();
    registerScopedTool(server as any, "list_responses", CONFIG, ["responses:read"], vi.fn() as any);

    await tools
      .get("list_responses")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["surveys:read"], "req_read", API_KEY_AUTH) } });

    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(queueV3AuditLog).not.toHaveBeenCalled();
  });

  test("audits nothing when the scope check passes — the tool's own runner records the outcome", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerScopedTool(server as any, "delete_response", AUDITED, ["responses:write"], handler as any);

    await tools
      .get("delete_response")!
      .handler(
        { responseId: "x" },
        { http: { authInfo: authInfoWithScopes(["responses:write"], "req_ok", API_KEY_AUTH) } }
      );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(queueV3AuditLog).not.toHaveBeenCalled();
  });

  test("keeps `audit` out of the config it hands the SDK", () => {
    const { server, tools } = createToolServer();

    registerScopedTool(server as any, "delete_response", AUDITED, ["responses:write"], vi.fn() as any);

    expect(tools.get("delete_response")?.config).toEqual(CONFIG);
    expect(tools.get("delete_response")?.config).not.toHaveProperty("audit");
    expect(server.registerTool.mock.calls[0][1]).not.toHaveProperty("audit");
  });
});

/**
 * The ENG-2119 invariant, as a test rather than a convention.
 *
 * `registerScopedTool` takes the scope as a required argument, so the compiler already stops a tool
 * being registered without one — verified separately, and `tsc` reports `Expected 5 arguments, but
 * got 4`. What the compiler cannot stop is someone re-exporting the raw guards and gating by hand
 * inside a handler again, which is exactly how the guarantee was lost the first time: the
 * feedback-record tools did that for ten tools, and nothing failed.
 *
 * So this pins the module's public surface. If a guard is exported again, this is the test that says
 * the structural gate just became conventional.
 */
describe("the scope guards stay private (ENG-2119)", () => {
  test("registerScopedTool is the only export", async () => {
    const guardScopes = await import("./guard-scopes");

    expect(Object.keys(guardScopes).sort()).toEqual(["registerScopedTool"]);
  });
});
