import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import {
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  validateV3SurveyFromRawInput,
} from "@/app/api/v3/surveys/lib/operations";
import { buildListSurveysSearchParams, registerSurveyTools } from "./surveys";

// Asserted as a shape, not by calling getMcpResourceUrl() here: comparing production's value with
// itself would still pass if it regressed to the bare path "/api/mcp" — the ENG-2173 bug. The
// invariant that matters is that the audit apiUrl is absolute, because the audit schema validates it
// with z.url() and drops the whole event otherwise.
const ABSOLUTE_MCP_AUDIT_URL = expect.stringMatching(/^https?:\/\/[^/]+\/api\/mcp$/);

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  createV3SurveyResponseFromRawInput: vi.fn(),
  deleteV3Survey: vi.fn(),
  getV3Survey: vi.fn(),
  listV3Surveys: vi.fn(),
  patchV3SurveyResponse: vi.fn(),
  validateV3SurveyFromRawInput: vi.fn(),
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

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: {
    accessControl: { read: true, write: true },
  },
  workspacePermissions: [
    {
      workspaceId: "clxx1234567890123456789012",
      workspaceName: "Workspace",
      permission: ApiKeyPermission.write,
    },
  ],
};

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["surveys:read", "surveys:write"],
  extra: {
    formbricksAuthentication: apiKeyAuth,
    requestId: "req_tool",
  },
};

const readOnlyOAuthAuthInfo = {
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["surveys:read"],
  extra: {
    formbricksAuthentication: {
      user: {
        id: "user_1",
        email: "person@example.com",
        name: "Person",
      },
      expires: "2026-07-01T00:00:00.000Z",
    },
    requestId: "req_tool",
    authMethod: "oauth",
  },
};

const writeOnlyOAuthAuthInfo = {
  ...readOnlyOAuthAuthInfo,
  scopes: ["surveys:write"],
};

function createToolServer() {
  const tools = new Map<
    string,
    {
      config: Record<string, unknown>;
      handler: (input: any, extra: any) => Promise<any>;
    }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };

  registerSurveyTools(server as any);
  return { server, tools };
}

describe("buildListSurveysSearchParams", () => {
  test("applies defensive defaults when optional defaults are not materialized", () => {
    const params = buildListSurveysSearchParams({
      workspaceId: "clxx1234567890123456789012",
    } as unknown as Parameters<typeof buildListSurveysSearchParams>[0]);

    expect(params.get("limit")).toBe("20");
    expect(params.has("includeTotalCount")).toBe(false);
  });

  test("maps structured MCP filters to v3 query parameters", () => {
    const params = buildListSurveysSearchParams({
      workspaceId: "clxx1234567890123456789012",
      limit: 50,
      cursor: "cursor_1",
      includeTotalCount: false,
      sortBy: "updatedAt",
      filter: {
        name: { contains: "Onboarding" },
        status: { in: ["draft", "inProgress"] },
        type: { in: ["link"] },
      },
    });

    expect(params.get("workspaceId")).toBe("clxx1234567890123456789012");
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("includeTotalCount")).toBe("false");
    expect(params.get("sortBy")).toBe("updatedAt");
    expect(params.get("filter[name][contains]")).toBe("Onboarding");
    expect(params.getAll("filter[status][in]")).toEqual(["draft", "inProgress"]);
    expect(params.getAll("filter[type][in]")).toEqual(["link"]);
  });
});

describe("registerSurveyTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers survey tools with planning annotations", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(6);
    expect(tools.get("list_surveys")?.config).toMatchObject({
      title: "List surveys",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(tools.get("get_survey")?.config).toMatchObject({
      title: "Get survey",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(tools.get("create_survey")?.config).toMatchObject({
      title: "Create survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    });
    expect(
      Object.keys((tools.get("create_survey")?.config.inputSchema as z.ZodObject<z.ZodRawShape>).shape)
    ).toEqual(
      expect.arrayContaining([
        "workspaceId",
        "name",
        "type",
        "status",
        "defaultLanguage",
        "metadata",
        "languages",
        "welcomeCard",
        "blocks",
        "endings",
        "hiddenFields",
        "variables",
      ])
    );
    expect(tools.get("validate_survey")?.config).toMatchObject({
      title: "Validate survey",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(
      Object.keys((tools.get("validate_survey")?.config.inputSchema as z.ZodObject<z.ZodRawShape>).shape)
    ).toEqual(expect.arrayContaining(["operation", "surveyId", "data"]));
    expect(tools.get("patch_survey")?.config).toMatchObject({
      title: "Patch survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
    expect(tools.get("delete_survey")?.config).toMatchObject({
      title: "Delete survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
  });

  test("list_surveys calls the shared v3 list operation and returns structured content", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Surveys).mockResolvedValue(
      successListResponse(
        [{ id: "survey_1" }],
        { limit: 20, nextCursor: null, totalCount: 1 },
        { requestId: "req_tool" }
      )
    );

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
        limit: 20,
        includeTotalCount: true,
      },
      { http: { authInfo } }
    );

    expect(listV3Surveys).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: apiKeyAuth,
        requestId: "req_tool",
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent).toEqual({
      data: [{ id: "survey_1" }],
      meta: { limit: 20, nextCursor: null, totalCount: 1 },
      requestId: "req_tool",
    });
  });

  test("list_surveys maps v3 problem responses to MCP tool errors", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Surveys).mockResolvedValue(
      problemBadRequest("req_bad", "Invalid query parameters", {
        instance: "/api/mcp",
        invalid_params: [{ name: "limit", reason: "Too big" }],
      })
    );

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
        limit: 101,
        includeTotalCount: true,
      },
      { http: { authInfo } }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 400,
      code: "bad_request",
      requestId: "req_bad",
      invalid_params: [{ name: "limit", reason: "Too big" }],
    });
  });

  test("get_survey calls the shared v3 get operation", async () => {
    const { tools } = createToolServer();
    vi.mocked(getV3Survey).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool" })
    );

    const result = await tools.get("get_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
        lang: ["en-US"],
      },
      { http: { authInfo } }
    );

    expect(getV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      lang: ["en-US"],
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012" },
      requestId: "req_tool",
    });
  });

  test("create_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    const createBody = {
      workspaceId: "clxx1234567890123456789012",
      name: "New survey",
      type: "link",
      status: "draft",
      metadata: {},
      defaultLanguage: "en-US",
      languages: [],
      welcomeCard: { enabled: false },
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "feedback",
              type: "openText",
              headline: { "en-US": "What should we improve?" },
              required: true,
            },
          ],
        },
      ],
      endings: [],
      hiddenFields: { enabled: false, fieldIds: [] },
      variables: [],
    };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(createV3SurveyResponseFromRawInput).mockResolvedValue(
      createdResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool", location: "/survey" })
    );

    const result = await tools.get("create_survey")!.handler(createBody, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(createV3SurveyResponseFromRawInput).toHaveBeenCalledWith({
      body: createBody,
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012" },
      requestId: "req_tool",
    });
  });

  test("validate_survey calls the shared v3 validation operation without audit logging", async () => {
    const { tools } = createToolServer();
    const validationBody = {
      operation: "create" as const,
      data: {
        workspaceId: "clxx1234567890123456789012",
        name: "New survey",
      },
    };
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse({ valid: true, operation: "create", invalid_params: [] }, { requestId: "req_tool" })
    );

    const result = await tools.get("validate_survey")!.handler(validationBody, { http: { authInfo } });

    expect(validateV3SurveyFromRawInput).toHaveBeenCalledWith({
      body: validationBody,
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(queueV3AuditLog).not.toHaveBeenCalled();
    expect(result.structuredContent).toEqual({
      data: { valid: true, operation: "create", invalid_params: [] },
      requestId: "req_tool",
    });
  });

  test("patch_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    const patchInput = {
      surveyId: "clxx1234567890123456789012",
      data: {
        name: "Updated survey",
      },
    };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(patchV3SurveyResponse).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012", name: "Updated survey" }, { requestId: "req_tool" })
    );

    const result = await tools.get("patch_survey")!.handler(patchInput, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(patchV3SurveyResponse).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      body: {
        name: "Updated survey",
      },
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012", name: "Updated survey" },
      requestId: "req_tool",
    });
  });

  test("delete_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(deleteV3Survey).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo } }
    );

    expect(deleteV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      requestId: "req_tool",
    });
  });

  test("delete_survey preserves forbidden errors without leaking resource existence", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(deleteV3Survey).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo } }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "You are not authorized to access this resource",
      requestId: "req_forbidden",
    });
    expect(auditLog).toMatchObject({
      status: "failure",
      eventId: "req_tool",
    });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("write tools return MCP errors for read-only OAuth scopes", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo: readOnlyOAuthAuthInfo } }
    );

    expect(deleteV3Survey).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "OAuth token does not include the required MCP scope: surveys:write",
      requestId: "req_tool",
    });
  });

  // Covers the MCP scope gate only — validateV3SurveyFromRawInput is mocked here, so this passed
  // even while the real v3 operation demanded readWrite and 403'd every read-scoped caller
  // (ENG-2179). The v3 gate itself is asserted in app/api/v3/surveys/lib/operations.test.ts.
  test("validate_survey allows patch validations for read-only OAuth scopes", async () => {
    const { tools } = createToolServer();
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse({ valid: true, operation: "patch", invalid_params: [] }, { requestId: "req_tool" })
    );

    const result = await tools.get("validate_survey")!.handler(
      {
        operation: "patch",
        surveyId: "clxx1234567890123456789012",
        data: {
          name: "Updated survey",
        },
      },
      { http: { authInfo: readOnlyOAuthAuthInfo } }
    );

    expect(validateV3SurveyFromRawInput).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      data: { valid: true, operation: "patch", invalid_params: [] },
      requestId: "req_tool",
    });
  });

  test("read tools return MCP errors for OAuth tokens without read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
      },
      { http: { authInfo: writeOnlyOAuthAuthInfo } }
    );

    expect(listV3Surveys).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "OAuth token does not include the required MCP scope: surveys:read",
      requestId: "req_tool",
    });
  });
});

/**
 * ENG-2256, pinned against the real SDK. Every other test in this file calls the registered handler
 * directly, which skips the SDK's `validateToolInput` — the exact reason a dropped argument was
 * invisible from our side of the boundary for as long as it was. This goes through a real `McpServer`
 * and a real `tools/call`.
 *
 * `list_surveys` rather than the ticket's `count_feedback_records`: that schema extends an
 * already-`.strict()` v3 filter schema and Zod 4's `.extend()` carries strictness over, so it would pass
 * with or without the `.strict()` this change adds. The survey schemas are plain `z.object`s, so here
 * the strictness is genuinely load-bearing and removing it fails this test.
 */
describe("tool arguments are validated by the SDK (ENG-2256)", () => {
  type ToolCallOutcome = {
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
  };

  // Both protocol legs are exercised: the one endpoint answers both (`mcp-handler` serves with
  // `legacy: "stateless"`), and validation must not differ between them. A 2026-07-28 request carries
  // the `Mcp-Method`/`Mcp-Name` headers and the `_meta` envelope the revision requires; a legacy one is
  // a plain JSON-RPC POST whose response comes back SSE-framed.
  const callTool = async (
    name: string,
    args: Record<string, unknown>,
    era: "modern" | "legacy" = "modern"
  ): Promise<ToolCallOutcome> => {
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "test", version: "0.0.0" });
      registerSurveyTools(server);
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

  test.each(["modern", "legacy"] as const)(
    "rejects an undeclared argument instead of silently dropping it (%s era)",
    async (era) => {
      const outcome = await callTool(
        "list_surveys",
        { workspaceId: "clxx1234567890123456789012", statuses: ["draft"] },
        era
      );

      expect(outcome.result?.isError).toBe(true);
      expect(errorText(outcome)).toContain("statuses");
      // The point of the fix: the operation is never reached, so a filter the caller believed was
      // applied cannot come back as a wider result set reported as success.
      expect(listV3Surveys).not.toHaveBeenCalled();
    }
  );

  test("accepts the declared spelling and reaches the operation", async () => {
    vi.mocked(listV3Surveys).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const outcome = await callTool("list_surveys", {
      workspaceId: "clxx1234567890123456789012",
      filter: { status: { in: ["draft"] } },
    });

    expect(outcome.result?.isError).toBeUndefined();
    expect(listV3Surveys).toHaveBeenCalled();
  });
});
