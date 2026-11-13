import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { recordMcpReachConfirmed, recordMcpReachDenied } from "@/lib/authorization/context";
import { registerMcpTool } from "./guard-permissions";
import { FULL_MCP_GRANT } from "./test-utils";

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

// A minimal stand-in for McpServer that captures what registerMcpTool registers.
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
    extra: {
      requestId,
      grant: FULL_MCP_GRANT,
      ...(authentication ? { formbricksAuthentication: authentication } : {}),
    },
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

describe("registerMcpTool", () => {
  test("registers the tool under its name with the config untouched", () => {
    const { server, tools } = createToolServer();

    registerMcpTool(
      server as any,
      "do_thing",
      CONFIG,
      [{ permission: "surveys", level: "write" }],
      vi.fn() as any
    );

    expect(server.registerTool).toHaveBeenCalledTimes(1);
    expect(server.registerTool.mock.calls[0][0]).toBe("do_thing");
    expect(tools.get("do_thing")?.config).toBe(CONFIG);
  });

  test("runs the handler and returns its result when the token holds every required scope", async () => {
    const { server, tools } = createToolServer();
    const handlerResult = { structuredContent: { ok: true } } as unknown as CallToolResult;
    const handler = vi.fn().mockResolvedValue(handlerResult);
    registerMcpTool(
      server as any,
      "do_thing",
      CONFIG,
      [
        { permission: "surveys", level: "read" },
        { permission: "creatives", level: "write" },
      ],
      handler as any
    );

    const input = { a: 1 };
    const ctx = { http: { authInfo: authInfoWithScopes(["surveys:read", "surveys:write"]) } };
    const result = await tools.get("do_thing")!.handler(input, ctx);

    expect(handler).toHaveBeenCalledWith(input, ctx);
    expect(result).toBe(handlerResult);
  });

  test("blocks the handler with a 403 insufficient-scope result when a required scope is missing", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerMcpTool(
      server as any,
      "do_thing",
      CONFIG,
      [{ permission: "surveys", level: "write" }],
      handler as any
    );

    const result = await tools
      .get("do_thing")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["surveys:read"], "req_denied") } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.structuredContent as ScopeErrorContent).error).toMatchObject({
      status: 403,
      code: "forbidden",
      // The permission and the missing scope must be in the body: this result reaches the client as a
      // JSON-RPC payload with no headers, so the WWW-Authenticate challenge cannot tell it what to
      // re-authorize for.
      detail:
        "Not permitted: the user's grant to this MCP client can't include Surveys: Write, because its OAuth token lacks the scope surveys:write. Ask the user to reconnect the client and give it this access.",
      requestId: "req_denied",
    });
  });

  test("denies when the token holds the scope of only some of the declared permissions", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerMcpTool(
      server as any,
      "read_chart",
      CONFIG,
      [
        { permission: "charts", level: "read" },
        { permission: "feedbackRecords", level: "read" },
      ],
      handler as any
    );

    const result = await tools
      .get("read_chart")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["dashboards:read"]) } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // Names what the token lacks, not what it already holds.
    expect((result.structuredContent as ScopeErrorContent).error.detail).toBe(
      "Not permitted: the user's grant to this MCP client can't include Feedback records: Read, because its OAuth token lacks the scope feedbackRecords:read. Ask the user to reconnect the client and give it this access."
    );
  });

  test("names a scope once when two declared permissions share a scope family", async () => {
    const { server, tools } = createToolServer();
    registerMcpTool(
      server as any,
      "do_thing",
      CONFIG,
      [
        { permission: "surveys", level: "read" },
        { permission: "surveyStyling", level: "read" },
      ],
      vi.fn() as any
    );

    const result = await tools
      .get("do_thing")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["responses:read"]) } });

    expect((result.structuredContent as ScopeErrorContent).error.detail).toBe(
      "Not permitted: the user's grant to this MCP client can't include Surveys: Read and Survey styling: Read, because its OAuth token lacks the scope surveys:read. Ask the user to reconnect the client and give it this access."
    );
  });

  test("allows an any-of tool when the token holds the scope of one listed permission", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerMcpTool(
      server as any,
      "discover",
      CONFIG,
      {
        anyOf: [
          { permission: "surveys", level: "read" },
          { permission: "dashboards", level: "read" },
        ],
      },
      handler as any
    );

    await tools.get("discover")!.handler({}, { http: { authInfo: authInfoWithScopes(["dashboards:read"]) } });
    const refused = await tools
      .get("discover")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["responses:read"]) } });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(refused.isError).toBe(true);
    expect((refused.structuredContent as ScopeErrorContent).error.detail).toBe(
      "Not permitted: the user's grant to this MCP client can't include any of Surveys: Read, Dashboards: Read, because its OAuth token lacks every one of the scopes surveys:read dashboards:read. Ask the user to reconnect the client and give it this access."
    );
  });

  test("gates an input-dependent tool on the permissions its input selects", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerMcpTool(
      server as any,
      "read_data",
      CONFIG,
      {
        byInput: (input) =>
          (input as { viaDashboard?: boolean }).viaDashboard
            ? [{ permission: "dashboards", level: "read" }]
            : [
                { permission: "charts", level: "read" },
                { permission: "feedbackRecords", level: "read" },
              ],
      },
      handler as any
    );
    const ctx = { http: { authInfo: authInfoWithScopes(["dashboards:read"]) } };

    await tools.get("read_data")!.handler({ viaDashboard: true }, ctx);
    const refused = await tools.get("read_data")!.handler({ viaDashboard: false }, ctx);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(refused.isError).toBe(true);
  });

  test("refuses an input-dependent tool whose input selects no permission — it never gates on nothing", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerMcpTool(
      server as any,
      "read_data",
      CONFIG,
      { byInput: () => [] as unknown as [{ permission: "charts"; level: "read" }] },
      handler as any
    );

    const result = await tools
      .get("read_data")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["dashboards:read", "feedbackRecords:read"]) } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.structuredContent as ScopeErrorContent).error).toMatchObject({ status: 403 });
  });
});

/**
 * A tool joins the grant through the permissions it declares, so a tool that declares none — or one the
 * registry does not offer — must not register at all. The types already refuse these; the casts below
 * stand for what the types cannot see (a computed list, an `as` at the call site).
 */
describe("registerMcpTool — refusing a tool without a valid permission", () => {
  test.each([
    ["no permission", []],
    ["an empty any-of", { anyOf: [] }],
    ["No access as the minimum level", [{ permission: "surveys", level: "none" }]],
    ["a level the permission does not offer", [{ permission: "workflowRuns", level: "write" }]],
    ["an unknown permission", [{ permission: "everything", level: "read" }]],
    [
      "one invalid permission among valid ones",
      [
        { permission: "surveys", level: "read" },
        { permission: "feedbackDatasets", level: "write" },
      ],
    ],
  ])("throws on %s and registers nothing", (_case, permissions) => {
    const { server } = createToolServer();

    expect(() =>
      registerMcpTool(server as any, "bad_tool", CONFIG, permissions as never, vi.fn() as any)
    ).toThrow(/bad_tool/);
    expect(server.registerTool).not.toHaveBeenCalled();
  });
});

/**
 * ENG-2872. The gate runs before the tool's own audit runner, so a read-only credential reaching for a
 * mutation used to leave no trace — the one attempt an audit trail exists to show. These pin that a
 * refused mutation is written down as a failure attributed to the caller, and that nothing else is.
 */
describe("registerMcpTool — auditing refused mutations", () => {
  const AUDITED = {
    ...CONFIG,
    audit: { action: "deleted", targetType: "response", targetIdArg: "responseId" },
  } as const;

  test("audits a refused mutation as a failed attempt by the actor, against the id it named", async () => {
    const { server, tools } = createToolServer();
    registerMcpTool(
      server as any,
      "delete_response",
      AUDITED,
      [{ permission: "responses", level: "write" }],
      vi.fn() as any
    );

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
    registerMcpTool(
      server as any,
      "duplicate_workflow",
      created,
      [{ permission: "workflows", level: "write" }],
      vi.fn() as any
    );

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
    registerMcpTool(
      server as any,
      "list_responses",
      CONFIG,
      [{ permission: "responses", level: "read" }],
      vi.fn() as any
    );

    await tools
      .get("list_responses")!
      .handler({}, { http: { authInfo: authInfoWithScopes(["surveys:read"], "req_read", API_KEY_AUTH) } });

    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(queueV3AuditLog).not.toHaveBeenCalled();
  });

  test("audits nothing when the scope check passes — the tool's own runner records the outcome", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerMcpTool(
      server as any,
      "delete_response",
      AUDITED,
      [{ permission: "responses", level: "write" }],
      handler as any
    );

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

    registerMcpTool(
      server as any,
      "delete_response",
      AUDITED,
      [{ permission: "responses", level: "write" }],
      vi.fn() as any
    );

    expect(tools.get("delete_response")?.config).toEqual(CONFIG);
    expect(tools.get("delete_response")?.config).not.toHaveProperty("audit");
    expect(server.registerTool.mock.calls[0][1]).not.toHaveProperty("audit");
  });
});

/**
 * ENG-7149. The connection's grant is the second half of the gate: a tool runs only when the token's
 * scopes reach its permissions and the grant gives them at the level it needs. The integration suite
 * (`mcp-grants.integration.test.ts`) drives this through `/api/mcp`; these pin the forms it doesn't reach.
 */
describe("registerMcpTool — the connection's grant", () => {
  const SESSION = { user: { id: "user_1" }, expires: "2099-01-01" };
  const EVERY_SCOPE = ["surveys:read", "surveys:write", "dashboards:read", "responses:read"];

  const withGrant = (permissions: Record<string, string> | null, authentication: unknown = SESSION) =>
    ({
      token: "tok",
      clientId: "client",
      scopes: EVERY_SCOPE,
      extra: {
        requestId: "req_grant",
        formbricksAuthentication: authentication,
        ...(permissions ? { grant: { access: "all", permissions } } : {}),
      },
    }) as unknown as AuthInfo;

  test("refuses a tool the grant doesn't give, naming the permission and level, and audits a mutation", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerMcpTool(
      server as any,
      "delete_survey",
      { ...CONFIG, audit: { action: "deleted", targetType: "survey", targetIdArg: "surveyId" } },
      [{ permission: "surveys", level: "write" }],
      handler as any
    );

    const result = await tools
      .get("delete_survey")!
      .handler(
        { surveyId: "clsur00000000000000000001" },
        { http: { authInfo: withGrant({ surveys: "read" }) } }
      );

    expect(handler).not.toHaveBeenCalled();
    expect((result.structuredContent as ScopeErrorContent).error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail:
        "Not permitted: the user's grant to this MCP client does not give Surveys: Write. Ask the user to give the client this access.",
    });
    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
  });

  test("names every permission an all-of tool lacks", async () => {
    const { server, tools } = createToolServer();
    registerMcpTool(
      server as any,
      "read_chart",
      CONFIG,
      [
        { permission: "charts", level: "read" },
        { permission: "feedbackRecords", level: "read" },
      ],
      vi.fn() as any
    );
    const authInfo = withGrant({ charts: "write" });
    (authInfo.scopes as string[]).push("feedbackRecords:read");

    const result = await tools.get("read_chart")!.handler({}, { http: { authInfo } });

    expect((result.structuredContent as ScopeErrorContent).error.detail).toContain(
      "does not give Feedback records: Read."
    );
  });

  test("runs an any-of tool when the grant gives one listed permission, and names them all when none", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerMcpTool(
      server as any,
      "discover",
      CONFIG,
      {
        anyOf: [
          { permission: "surveys", level: "read" },
          { permission: "dashboards", level: "read" },
        ],
      },
      handler as any
    );

    await tools.get("discover")!.handler({}, { http: { authInfo: withGrant({ dashboards: "read" }) } });
    const refused = await tools.get("discover")!.handler({}, { http: { authInfo: withGrant({}) } });

    expect(handler).toHaveBeenCalledTimes(1);
    expect((refused.structuredContent as ScopeErrorContent).error.detail).toContain(
      "does not give any of Surveys: Read, Dashboards: Read."
    );
  });

  test("refuses a user's call that carries no grant at all", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn();
    registerMcpTool(
      server as any,
      "list",
      CONFIG,
      [{ permission: "surveys", level: "read" }],
      handler as any
    );

    const result = await tools.get("list")!.handler({}, { http: { authInfo: withGrant(null) } });

    expect(handler).not.toHaveBeenCalled();
    expect((result.structuredContent as ScopeErrorContent).error.detail).toMatch(/^Not permitted: /);
  });

  test("gates an API key, which has no grant, on its scopes alone", async () => {
    const { server, tools } = createToolServer();
    const handler = vi.fn().mockResolvedValue({ structuredContent: {} });
    registerMcpTool(
      server as any,
      "list",
      CONFIG,
      [{ permission: "surveys", level: "read" }],
      handler as any
    );

    await tools.get("list")!.handler({}, { http: { authInfo: withGrant(null, API_KEY_AUTH) } });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("registerMcpTool — what the grant doesn't reach (ADR-0042)", () => {
  const error = (status: number, code: string) =>
    ({
      isError: true,
      structuredContent: { error: { status, code, detail: "Denied", requestId: "req_guard" } },
      content: [{ type: "text", text: "{}" }],
    }) as CallToolResult;
  const NOT_FOUND = {
    error: {
      status: 404,
      title: "Not Found",
      code: "not_found",
      detail: "Not found. It doesn't exist, or the user's grant to this MCP client doesn't reach it.",
      requestId: "req_guard",
    },
  };

  const register = (
    handler: (...args: unknown[]) => Promise<CallToolResult>,
    access: "all" | "workspaces" = "workspaces"
  ) => {
    const { server, tools } = createToolServer();
    registerMcpTool(
      server as any,
      "read_thing",
      CONFIG,
      [{ permission: "surveys", level: "read" }],
      handler as any
    );
    const authInfo = authInfoWithScopes(["surveys:read"]);
    (authInfo.extra as { grant: unknown }).grant = { ...FULL_MCP_GRANT, access };
    return () => tools.get("read_thing")!.handler({}, { http: { authInfo } });
  };

  test("answers not found when the call was denied something on the grant's reach", async () => {
    const call = register(async () => {
      recordMcpReachConfirmed();
      recordMcpReachDenied();
      return error(403, "forbidden");
    });

    expect((await call()).structuredContent).toEqual(NOT_FOUND);
  });

  test("answers not found for a 403 or 404 given before any check confirmed the grant's reach", async () => {
    expect((await register(async () => error(403, "forbidden"))()).structuredContent).toEqual(NOT_FOUND);
    expect((await register(async () => error(404, "not_found"))()).structuredContent).toEqual(NOT_FOUND);
  });

  test("passes an answer about something the grant reaches through unchanged", async () => {
    for (const result of [error(403, "forbidden"), error(404, "not_found"), error(428, "")]) {
      expect(
        await register(async () => {
          recordMcpReachConfirmed();
          return result;
        })()
      ).toBe(result);
    }
  });

  test("passes any other error through, and every answer under All access", async () => {
    const invalid = error(422, "unprocessable_content");
    expect(await register(async () => invalid)()).toBe(invalid);
    const refused = error(403, "forbidden");
    expect(
      await register(async () => {
        recordMcpReachDenied();
        return refused;
      }, "all")()
    ).toBe(refused);
  });

  test("passes a success through even when something along the way was out of reach", async () => {
    const result = { structuredContent: { data: [] }, content: [] } as CallToolResult;
    expect(
      await register(async () => {
        recordMcpReachDenied();
        return result;
      })()
    ).toBe(result);
  });

  test("counts what a call learns only against that call", async () => {
    let calls = 0;
    const call = register(async () => {
      calls += 1;
      if (calls === 1) recordMcpReachDenied();
      else recordMcpReachConfirmed();
      return error(403, "forbidden");
    });

    expect((await call()).structuredContent).toEqual(NOT_FOUND);
    expect((await call()).structuredContent).toMatchObject({ error: { status: 403 } });
  });
});

/**
 * The ENG-2119 invariant, as a test rather than a convention.
 *
 * `registerMcpTool` takes the permissions as a required argument, so the compiler already stops a tool
 * being registered without them — verified separately, and `tsc` reports `Expected 5 arguments, but
 * got 4`. What the compiler cannot stop is someone re-exporting the raw guards and gating by hand
 * inside a handler again, which is exactly how the guarantee was lost the first time: the
 * feedback-record tools did that for ten tools, and nothing failed.
 *
 * So this pins the module's public surface. If a guard is exported again, this is the test that says
 * the structural gate just became conventional.
 */
describe("the guards stay private (ENG-2119)", () => {
  test("registerMcpTool is the only export", async () => {
    const guard = await import("./guard-permissions");

    expect(Object.keys(guard).sort()).toEqual(["registerMcpTool"]);
  });
});
