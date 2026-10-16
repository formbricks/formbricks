import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import {
  archiveV3Creative,
  createV3Creative,
  deleteV3Creative,
  duplicateV3Creative,
  getV3Creative,
  getV3CreativeStats,
  listV3Creatives,
  patchV3Creative,
  restoreV3Creative,
} from "@/app/api/v3/creatives/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { buildListCreativesSearchParams, registerCreativeTools } from "./creatives";

vi.mock("@/app/api/v3/creatives/lib/operations", () => ({
  archiveV3Creative: vi.fn(),
  createV3Creative: vi.fn(),
  deleteV3Creative: vi.fn(),
  duplicateV3Creative: vi.fn(),
  getV3Creative: vi.fn(),
  getV3CreativeStats: vi.fn(),
  listV3Creatives: vi.fn(),
  patchV3Creative: vi.fn(),
  restoreV3Creative: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// The audit schema validates `apiUrl` with z.url() and drops the whole event otherwise (ENG-2173), so the
// shape that matters is an absolute URL, asserted as one rather than by calling production's getter.
const ABSOLUTE_MCP_AUDIT_URL = expect.stringMatching(/^https?:\/\/[^/]+\/api\/mcp$/);

const workspaceId = "clxx1234567890123456789012";
const creativeId = "clcr1234567890123456789012";

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: ApiKeyPermission.write }],
};

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["surveys:read", "surveys:write"],
  extra: { formbricksAuthentication: apiKeyAuth, requestId: "req_tool" },
};

// What `getMcpScopes` derives for an API key holding only `read`: the surveys scopes are all the creative
// tools look at, so the key's workspace permission is the same gate it is for surveys.
const readOnlyApiKeyAuthInfo = {
  ...authInfo,
  scopes: ["surveys:read"],
  extra: {
    formbricksAuthentication: {
      ...apiKeyAuth,
      workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: ApiKeyPermission.read }],
    },
    requestId: "req_tool",
  },
};

const readOnlyOAuthAuthInfo = {
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["surveys:read"],
  extra: {
    formbricksAuthentication: {
      user: { id: "user_1", email: "person@example.com", name: "Person" },
      expires: "2026-07-01T00:00:00.000Z",
    },
    requestId: "req_tool",
    authMethod: "oauth",
  },
};

const writeOnlyOAuthAuthInfo = { ...readOnlyOAuthAuthInfo, scopes: ["surveys:write"] };

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

  registerCreativeTools(server as any);
  return { server, tools };
}

const READ_TOOLS = ["list_creatives", "get_creative", "get_creative_stats"] as const;
const WRITE_TOOLS = [
  "create_creative",
  "patch_creative",
  "delete_creative",
  "duplicate_creative",
  "archive_creative",
  "restore_creative",
] as const;

const feedbackButtonContent = { label: { "en-US": "Feedback" }, icon: null };
const createBody = {
  workspaceId,
  name: "Feedback tab",
  type: "feedbackButton" as const,
  status: "draft" as const,
  defaultLanguage: "en-US",
  content: feedbackButtonContent,
};

/** Every tool with a valid input, so one table can drive the gating tests for the whole roster. */
const inputs: Record<string, Record<string, unknown>> = {
  list_creatives: { workspaceId, limit: 20 },
  get_creative: { creativeId },
  get_creative_stats: { creativeId, groupBy: "page" },
  create_creative: createBody,
  patch_creative: { creativeId, data: { name: "Renamed" } },
  delete_creative: { creativeId },
  duplicate_creative: { creativeId },
  archive_creative: { creativeId },
  restore_creative: { creativeId },
};

const operations = {
  list_creatives: listV3Creatives,
  get_creative: getV3Creative,
  get_creative_stats: getV3CreativeStats,
  create_creative: createV3Creative,
  patch_creative: patchV3Creative,
  delete_creative: deleteV3Creative,
  duplicate_creative: duplicateV3Creative,
  archive_creative: archiveV3Creative,
  restore_creative: restoreV3Creative,
} as const;

describe("buildListCreativesSearchParams", () => {
  test("applies the default page size when the optional default was not materialized", () => {
    const params = buildListCreativesSearchParams({ workspaceId } as Parameters<
      typeof buildListCreativesSearchParams
    >[0]);

    expect(params.get("workspaceId")).toBe(workspaceId);
    expect(params.get("limit")).toBe("20");
  });

  test("maps the structured MCP filters onto the v3 query parameters", () => {
    const params = buildListCreativesSearchParams({
      workspaceId,
      limit: 50,
      cursor: "cursor_1",
      surveyId: "clsv1234567890123456789012",
      sortBy: "name",
      filter: {
        name: { contains: "Maintenance" },
        type: { in: ["banner", "feedbackButton"] },
        displayStatus: { in: ["active", "archived"] },
      },
    });

    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("surveyId")).toBe("clsv1234567890123456789012");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("filter[name][contains]")).toBe("Maintenance");
    expect(params.getAll("filter[type][in]")).toEqual(["banner", "feedbackButton"]);
    expect(params.getAll("filter[displayStatus][in]")).toEqual(["active", "archived"]);
  });
});

describe("registerCreativeTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers exactly the nine creative tools, and no validate_creative", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(9);
    expect([...tools.keys()].toSorted()).toEqual([...READ_TOOLS, ...WRITE_TOOLS].toSorted());
  });

  test("declares honest annotations", () => {
    const { tools } = createToolServer();
    const annotationsOf = (name: string) => tools.get(name)?.config.annotations;

    for (const name of READ_TOOLS) {
      expect(annotationsOf(name), name).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });
    }
    // Creates and copies add a creative each time.
    for (const name of ["create_creative", "duplicate_creative"]) {
      expect(annotationsOf(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      });
    }
    // A patch replaces whole groups, and a deleted creative cannot come back.
    for (const name of ["patch_creative", "delete_creative"]) {
      expect(annotationsOf(name), name).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
    // Reversible, and a second call finds nothing left to change.
    for (const name of ["archive_creative", "restore_creative"]) {
      expect(annotationsOf(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      });
    }
  });

  test("every tool declares an output schema", () => {
    const { tools } = createToolServer();

    for (const [name, { config }] of tools) {
      expect(config.outputSchema, name).toBeDefined();
    }
  });

  describe("scope gating", () => {
    test.each(READ_TOOLS)("%s needs surveys:read and refuses a token without it", async (name) => {
      const { tools } = createToolServer();

      const result = await tools
        .get(name)!
        .handler(inputs[name], { http: { authInfo: writeOnlyOAuthAuthInfo } });

      expect(operations[name]).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        status: 403,
        code: "forbidden",
        detail: "OAuth token does not include the required MCP scope: surveys:read",
        requestId: "req_tool",
      });
    });

    // Every write tool, so one registered under `surveys:read` by mistake fails here: for an OAuth user who
    // holds the write role, and for an API key with write permission, this scope is the only barrier.
    test.each(WRITE_TOOLS)("%s needs surveys:write and refuses a read-only token", async (name) => {
      const { tools } = createToolServer();

      for (const readOnly of [readOnlyOAuthAuthInfo, readOnlyApiKeyAuthInfo]) {
        const result = await tools.get(name)!.handler(inputs[name], { http: { authInfo: readOnly } });

        expect(operations[name], name).not.toHaveBeenCalled();
        expect(result.isError, name).toBe(true);
        expect(result.structuredContent.error, name).toMatchObject({
          status: 403,
          code: "forbidden",
          detail: expect.stringContaining("surveys:write"),
        });
      }
    });

    test.each(READ_TOOLS)("%s runs for a read-only API key", async (name) => {
      const { tools } = createToolServer();
      vi.mocked(operations[name]).mockResolvedValue(successResponse({}, { requestId: "req_tool" }));

      const result = await tools
        .get(name)!
        .handler(inputs[name], { http: { authInfo: readOnlyApiKeyAuthInfo } });

      expect(operations[name]).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });

    test.each([
      ["create_creative", "created", undefined],
      ["patch_creative", "updated", creativeId],
      ["delete_creative", "deleted", creativeId],
      ["duplicate_creative", "created", undefined],
      ["archive_creative", "archived", creativeId],
      ["restore_creative", "restored", creativeId],
    ] as const)("a refused %s is audited as a failed %s attempt", async (name, action, targetId) => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" } as { status: string; targetId?: string };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);

      await tools.get(name)!.handler(inputs[name], { http: { authInfo: readOnlyOAuthAuthInfo } });

      expect(buildV3AuditLog).toHaveBeenCalledWith(
        expect.anything(),
        action,
        "creative",
        ABSOLUTE_MCP_AUDIT_URL
      );
      // A creation names no target: the ids in its input name other things (the workspace, the original).
      expect(auditLog.targetId).toBe(targetId);
      expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    });
  });

  describe("adapter mapping", () => {
    const callContext = {
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
    };

    test("list_creatives passes the mapped query to the list operation and relays the page", async () => {
      const { tools } = createToolServer();
      vi.mocked(listV3Creatives).mockResolvedValue(
        successListResponse([{ id: creativeId }], { limit: 20, nextCursor: null }, { requestId: "req_tool" })
      );

      const result = await tools
        .get("list_creatives")!
        .handler({ workspaceId, limit: 20, filter: { type: { in: ["banner"] } } }, { http: { authInfo } });

      expect(listV3Creatives).toHaveBeenCalledTimes(1);
      const [call] = vi.mocked(listV3Creatives).mock.calls[0];
      expect(call).toMatchObject(callContext);
      expect(call.searchParams.get("workspaceId")).toBe(workspaceId);
      expect(call.searchParams.getAll("filter[type][in]")).toEqual(["banner"]);
      expect(result.structuredContent).toEqual({
        data: [{ id: creativeId }],
        meta: { limit: 20, nextCursor: null },
        requestId: "req_tool",
      });
    });

    test("get_creative passes the id with the caller's authentication", async () => {
      const { tools } = createToolServer();
      vi.mocked(getV3Creative).mockResolvedValue(
        successResponse({ id: creativeId }, { requestId: "req_tool" })
      );

      const result = await tools.get("get_creative")!.handler({ creativeId }, { http: { authInfo } });

      expect(getV3Creative).toHaveBeenCalledWith({ creativeId, ...callContext });
      expect(result.structuredContent).toEqual({ data: { id: creativeId }, requestId: "req_tool" });
    });

    test("get_creative_stats passes the range and grouping as the operation's query", async () => {
      const { tools } = createToolServer();
      vi.mocked(getV3CreativeStats).mockResolvedValue(
        successResponse({ creativeId }, { requestId: "req_tool" })
      );

      await tools
        .get("get_creative_stats")!
        .handler(
          { creativeId, from: "2026-10-01", to: "2026-10-15", groupBy: "device" },
          { http: { authInfo } }
        );

      expect(getV3CreativeStats).toHaveBeenCalledWith({
        creativeId,
        query: { from: "2026-10-01", to: "2026-10-15", groupBy: "device" },
        ...callContext,
      });
    });

    test("get_creative_stats leaves an omitted range to the operation's defaults", async () => {
      const { tools } = createToolServer();
      vi.mocked(getV3CreativeStats).mockResolvedValue(
        successResponse({ creativeId }, { requestId: "req_tool" })
      );

      await tools.get("get_creative_stats")!.handler({ creativeId }, { http: { authInfo } });

      expect(getV3CreativeStats).toHaveBeenCalledWith({
        creativeId,
        query: { from: undefined, to: undefined, groupBy: undefined },
        ...callContext,
      });
    });

    test("create_creative hands the body to the operation and audits a success", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
      vi.mocked(createV3Creative).mockResolvedValue(
        createdResponse(
          { id: creativeId },
          { requestId: "req_tool", location: `/api/v3/creatives/${creativeId}` }
        )
      );

      const result = await tools.get("create_creative")!.handler(createBody, { http: { authInfo } });

      expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "creative", ABSOLUTE_MCP_AUDIT_URL);
      expect(createV3Creative).toHaveBeenCalledWith({ body: createBody, ...callContext, auditLog });
      expect(auditLog.status).toBe("success");
      expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
      expect(result.structuredContent).toEqual({ data: { id: creativeId }, requestId: "req_tool" });
    });

    test("patch_creative sends `data` as the body and the id on its own", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
      vi.mocked(patchV3Creative).mockResolvedValue(
        successResponse({ id: creativeId }, { requestId: "req_tool" })
      );

      await tools
        .get("patch_creative")!
        .handler({ creativeId, data: { status: "paused" } }, { http: { authInfo } });

      expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "creative", ABSOLUTE_MCP_AUDIT_URL);
      expect(patchV3Creative).toHaveBeenCalledWith({
        creativeId,
        body: { status: "paused" },
        ...callContext,
        auditLog,
      });
      expect(auditLog.status).toBe("success");
    });

    test("delete_creative relays the 204 as an acknowledgement and audits a success", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
      vi.mocked(deleteV3Creative).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

      const result = await tools.get("delete_creative")!.handler({ creativeId }, { http: { authInfo } });

      expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "deleted", "creative", ABSOLUTE_MCP_AUDIT_URL);
      expect(deleteV3Creative).toHaveBeenCalledWith({ creativeId, ...callContext, auditLog });
      expect(auditLog.status).toBe("success");
      expect(result.structuredContent).toEqual({ requestId: "req_tool" });
    });

    test.each([
      ["duplicate_creative", duplicateV3Creative, "created"],
      ["archive_creative", archiveV3Creative, "archived"],
      ["restore_creative", restoreV3Creative, "restored"],
    ] as const)(
      "%s calls its operation with the id and audits a success",
      async (name, operation, action) => {
        const { tools } = createToolServer();
        const auditLog = { status: "failure" };
        vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
        vi.mocked(operation).mockResolvedValue(
          successResponse({ id: creativeId }, { requestId: "req_tool" })
        );

        const result = await tools.get(name)!.handler({ creativeId }, { http: { authInfo } });

        expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, action, "creative", ABSOLUTE_MCP_AUDIT_URL);
        expect(operation).toHaveBeenCalledWith({ creativeId, ...callContext, auditLog });
        expect(auditLog.status).toBe("success");
        expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
        expect(result.structuredContent).toEqual({ data: { id: creativeId }, requestId: "req_tool" });
      }
    );
  });

  describe("errors", () => {
    test("get_creative relays the same 403 for a creative the caller cannot see", async () => {
      const { tools } = createToolServer();
      vi.mocked(getV3Creative).mockResolvedValue(
        problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
      );

      const result = await tools.get("get_creative")!.handler({ creativeId }, { http: { authInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        status: 403,
        code: "forbidden",
        detail: "You are not authorized to access this resource",
        requestId: "req_forbidden",
      });
    });

    test("a failed write is audited as a failure and its 422 field list reaches the agent", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
      vi.mocked(patchV3Creative).mockResolvedValue(
        problemUnprocessableContent("req_invalid", "The creative failed validation", {
          instance: "/api/mcp",
          invalid_params: [{ name: "destination", reason: "A published creative needs a Destination." }],
        })
      );

      const result = await tools
        .get("patch_creative")!
        .handler({ creativeId, data: { status: "inProgress" } }, { http: { authInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        status: 422,
        invalid_params: [{ name: "destination", reason: "A published creative needs a Destination." }],
      });
      expect(auditLog).toMatchObject({ status: "failure", eventId: "req_tool" });
      expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    });
  });
});

/**
 * Pinned against the real SDK, like the ENG-2256 block in `surveys.test.ts`: every test above calls the
 * registered handler directly, which skips the SDK's input validation, and `create_creative` is the one
 * tool whose input is validated by the v3 create body behind a flat object. So the claim that a
 * mismatched `content` never reaches the operation is only provable through a real `tools/call`.
 */
describe("tool arguments are validated by the SDK", () => {
  type ToolCallOutcome = { result?: { isError?: boolean; content?: { type: string; text?: string }[] } };

  const callTool = async (
    name: string,
    args: Record<string, unknown>,
    era: "modern" | "legacy" = "modern"
  ): Promise<ToolCallOutcome> => {
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "test", version: "0.0.0" });
      registerCreativeTools(server);
      return server;
    });

    const modern = era === "modern";
    const response = await handler.fetch(
      new Request("https://formbricks.test/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(modern ? { "Mcp-Method": "tools/call", "Mcp-Name": name } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name,
            arguments: args,
            ...(modern
              ? {
                  _meta: {
                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                    "io.modelcontextprotocol/clientCapabilities": {},
                  },
                }
              : {}),
          },
        }),
      }),
      { authInfo }
    );

    const text = await response.text();
    const payload = response.headers.get("content-type")?.includes("text/event-stream")
      ? text
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .join("")
      : text;

    return JSON.parse(payload) as ToolCallOutcome;
  };

  const errorText = (outcome: ToolCallOutcome) =>
    outcome.result?.content?.map((block) => block.text ?? "").join("") ?? "";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test.each(["modern", "legacy"] as const)(
    "rejects an undeclared argument instead of silently dropping it (%s era)",
    async (era) => {
      const outcome = await callTool("list_creatives", { workspaceId, statuses: ["active"] }, era);

      expect(outcome.result?.isError).toBe(true);
      expect(errorText(outcome)).toContain("statuses");
      expect(listV3Creatives).not.toHaveBeenCalled();
    }
  );

  test.each(["modern", "legacy"] as const)(
    "refuses a banner's content on a feedback button before any operation runs (%s era)",
    async (era) => {
      const outcome = await callTool(
        "create_creative",
        {
          ...createBody,
          content: {
            message: { "en-US": [{ text: "Hi" }] },
            button: null,
            dismissible: true,
            accessibleName: null,
          },
        },
        era
      );

      expect(outcome.result?.isError).toBe(true);
      expect(errorText(outcome)).toContain("content");
      expect(createV3Creative).not.toHaveBeenCalled();
    }
  );

  test("hands create_creative the parsed v3 body, defaults filled in", async () => {
    // An error result skips the SDK's output validation, which is not what this test is about: the
    // output schema is held against real operation output in `creative-schemas.test.ts`.
    vi.mocked(createV3Creative).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );
    const { status: _status, defaultLanguage: _defaultLanguage, ...withoutDefaults } = createBody;

    await callTool("create_creative", withoutDefaults);

    expect(createV3Creative).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createV3Creative).mock.calls[0][0].body).toMatchObject({
      type: "feedbackButton",
      status: "draft",
      defaultLanguage: "en-US",
    });
  });

  test("refuses a patch carrying a field the contract does not know", async () => {
    const outcome = await callTool("patch_creative", { creativeId, data: { type: "banner" } });

    expect(outcome.result?.isError).toBe(true);
    expect(errorText(outcome)).toContain("type");
    expect(patchV3Creative).not.toHaveBeenCalled();
  });
});
