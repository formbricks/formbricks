import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, test, vi } from "vitest";
import { registerScopedTool } from "./guard-scopes";

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

function authInfoWithScopes(scopes: string[], requestId = "req_guard"): AuthInfo {
  return {
    token: "tok",
    clientId: "client",
    scopes,
    extra: { requestId },
  } as unknown as AuthInfo;
}

const CONFIG = {
  title: "Do thing",
  description: "A guarded tool",
  annotations: { readOnlyHint: false },
};

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
    const extra = { authInfo: authInfoWithScopes(["surveys:read", "surveys:write"]) };
    const result = await tools.get("do_thing")!.handler(input, extra);

    expect(handler).toHaveBeenCalledWith(input, extra);
    expect(result).toBe(handlerResult);
  });

  test("blocks the handler with a 403 insufficient-scope result when a required scope is missing", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:write"], handler as any);

    const result = await tools
      .get("do_thing")!
      .handler({}, { authInfo: authInfoWithScopes(["surveys:read"], "req_denied") });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.structuredContent as ScopeErrorContent).error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "OAuth token does not include the required MCP scope",
      requestId: "req_denied",
    });
  });

  test("denies when the token holds only some of several required scopes", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerScopedTool(server as any, "do_thing", CONFIG, ["surveys:read", "surveys:write"], handler as any);

    const result = await tools
      .get("do_thing")!
      .handler({}, { authInfo: authInfoWithScopes(["surveys:read"]) });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });
});
