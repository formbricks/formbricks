import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import {
  createdResponse,
  problemBadRequest,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import {
  createV3SurveyResponseFromRawInput,
  listV3Surveys,
  validateV3SurveyFromRawInput,
} from "@/app/api/v3/surveys/lib/operations";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import { authenticateApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { POST } from "./route";

const { verifyAccessTokenMock, userFindUniqueMock } = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@better-auth/oauth-provider/resource-client", () => ({
  oauthProviderResourceClient: vi.fn(() => ({
    getActions: () => ({
      verifyAccessToken: verifyAccessTokenMock,
    }),
  })),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: {},
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/modules/auth/lib/oauth-urls", () => ({
  MCP_RESOURCE_SCOPES: ["surveys:read", "surveys:write"],
  getAuthIssuerUrl: () => "http://localhost/api/auth",
  getMcpOrigin: () => "http://localhost",
  getMcpProtectedResourceMetadataUrl: () => "http://localhost/.well-known/oauth-protected-resource/api/mcp",
  getMcpResourceUrl: () => "http://localhost/api/mcp",
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: vi.fn(),
  getBearerTokenFromHeaders: vi.fn((headers: Headers) => {
    const authorization = headers.get("authorization");
    return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  }),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

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

function createMcpRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
      "x-api-key": "fbk_test",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function readMcpResponse(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  const dataLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));

  return JSON.parse(dataLine ? dataLine.slice("data:".length).trim() : text);
}

describe("POST /api/mcp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(apiKeyAuth);
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
    userFindUniqueMock.mockResolvedValue({ isActive: true });
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user_1",
      email: "person@example.com",
      name: "Person",
      scope: "openid profile email surveys:read surveys:write",
      exp: Math.floor(Date.now() / 1000) + 900,
      azp: "client_1",
    });
    vi.mocked(listV3Surveys).mockResolvedValue(
      successListResponse([], { limit: 20, nextCursor: null, totalCount: 0 }, { requestId: "req_mcp" })
    );
  });

  test("returns 401 before MCP handling when authentication fails", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(null);

    const response = await POST(
      createMcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="http://localhost/.well-known/oauth-protected-resource/api/mcp" scope="surveys:read surveys:write"'
    );
    expect(applyIPRateLimit).toHaveBeenCalled();
  });

  test("returns 413 before MCP handling when content-length exceeds the v3 body limit", async () => {
    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        },
        {
          "content-length": String(DEFAULT_REQUEST_BODY_LIMIT_BYTES + 1),
          "x-request-id": "req_large",
        }
      )
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("X-Request-Id")).toBe("req_large");
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
  });

  test("lists MCP tools for a valid API key", async () => {
    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        },
        {
          "x-request-id": "req_tools",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req_tools");
    const message = await readMcpResponse(response);
    expect(message.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "list_surveys",
      "get_survey",
      "create_survey",
      "validate_survey",
      "patch_survey",
      "delete_survey",
      "list_workflows",
      "get_workflow",
      "list_workflow_runs",
      "get_workflow_run",
      "test_workflow",
      "create_workflow",
      "patch_workflow",
      "duplicate_workflow",
      "delete_workflow",
      "enable_workflow",
      "disable_workflow",
      "archive_workflow",
      "unarchive_workflow",
      "list_workspaces",
    ]);
    const tools = new Map(message.result.tools.map((tool: { name: string }) => [tool.name, tool]));
    expect(Object.keys((tools.get("create_survey") as any).inputSchema.properties)).toEqual(
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
    expect(Object.keys((tools.get("validate_survey") as any).inputSchema.properties)).toEqual(
      expect.arrayContaining(["operation", "surveyId", "data"])
    );
    expect(Object.keys((tools.get("patch_survey") as any).inputSchema.properties)).toEqual(
      expect.arrayContaining(["surveyId", "data"])
    );
    expect(message.result.tools.find((tool: { name: string }) => tool.name === "list_surveys")).toMatchObject(
      {
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      }
    );
    expect(message.result.tools.find((tool: { name: string }) => tool.name === "patch_survey")).toMatchObject(
      {
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
      }
    );
    expect(
      message.result.tools.find((tool: { name: string }) => tool.name === "delete_survey")
    ).toMatchObject({
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
  });

  test("calls list_surveys through the MCP route", async () => {
    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "list_surveys",
            arguments: {
              workspaceId: "clxx1234567890123456789012",
              limit: 20,
              includeTotalCount: true,
            },
          },
        },
        {
          "x-request-id": "req_mcp",
        }
      )
    );

    expect(response.status).toBe(200);
    const message = await readMcpResponse(response);
    expect(message.result.structuredContent).toEqual({
      data: [],
      meta: { limit: 20, nextCursor: null, totalCount: 0 },
      requestId: "req_mcp",
    });
    expect(listV3Surveys).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: apiKeyAuth,
        requestId: "req_mcp",
        instance: "/api/mcp",
      })
    );
  });

  test("authenticates an API key from an Authorization bearer token", async () => {
    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "list_surveys",
            arguments: {
              workspaceId: "clxx1234567890123456789012",
            },
          },
        },
        {
          authorization: "Bearer fbk_secret-with-hyphens",
          "x-api-key": "",
          "x-request-id": "req_bearer_api_key",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(authenticateApiKeyFromHeaders).toHaveBeenCalledTimes(1);
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(listV3Surveys).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: apiKeyAuth,
        requestId: "req_bearer_api_key",
      })
    );
  });

  test("authenticates OAuth bearer tokens without API-key lookup", async () => {
    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: {
            name: "list_surveys",
            arguments: {
              workspaceId: "clxx1234567890123456789012",
              limit: 20,
              includeTotalCount: true,
            },
          },
        },
        {
          authorization: "Bearer eyJhbGciOiJFZERTQSJ9.payload.signature",
          "x-api-key": "",
          "x-request-id": "req_oauth",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    expect(verifyAccessTokenMock).toHaveBeenCalledWith(
      "eyJhbGciOiJFZERTQSJ9.payload.signature",
      expect.objectContaining({
        verifyOptions: expect.objectContaining({
          audience: "http://localhost/api/mcp",
          issuer: "http://localhost/api/auth",
        }),
      })
    );
    expect(applyRateLimit).toHaveBeenCalledWith(expect.any(Object), "oauth:user_1:client_1");
    expect(listV3Surveys).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: {
          user: {
            id: "user_1",
            email: "person@example.com",
            name: "Person",
          },
          expires: expect.any(String),
        },
        requestId: "req_oauth",
        instance: "/api/mcp",
      })
    );
  });

  test("rejects invalid OAuth bearer tokens with an OAuth challenge", async () => {
    verifyAccessTokenMock.mockRejectedValueOnce(new Error("invalid token"));

    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 8,
          method: "tools/list",
          params: {},
        },
        {
          authorization: "Bearer eyJhbGciOiJFZERTQSJ9.invalid.signature",
          "x-api-key": "",
          "x-request-id": "req_invalid_oauth",
        }
      )
    );

    expect(response.status).toBe(401);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    expect(applyIPRateLimit).toHaveBeenCalled();
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="http://localhost/.well-known/oauth-protected-resource/api/mcp" scope="surveys:read surveys:write"'
    );
  });

  test("blocks write tools for read-only OAuth tokens", async () => {
    verifyAccessTokenMock.mockResolvedValueOnce({
      sub: "user_1",
      email: "person@example.com",
      scope: "openid profile email surveys:read",
      exp: Math.floor(Date.now() / 1000) + 900,
      azp: "client_read_only",
    });

    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: {
            name: "delete_survey",
            arguments: {
              surveyId: "clsv1234567890123456789012",
            },
          },
        },
        {
          authorization: "Bearer eyJhbGciOiJFZERTQSJ9.readonly.signature",
          "x-api-key": "",
          "x-request-id": "req_read_only",
        }
      )
    );

    expect(response.status).toBe(200);
    const message = await readMcpResponse(response);
    expect(message.result.isError).toBe(true);
    expect(message.result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "OAuth token does not include the required MCP scope",
      requestId: "req_read_only",
    });
  });

  test("calls create_survey through the MCP route", async () => {
    vi.mocked(createV3SurveyResponseFromRawInput).mockResolvedValue(
      createdResponse(
        { id: "clsv1234567890123456789012" },
        { requestId: "req_create", location: "/api/v3/surveys/clsv1234567890123456789012" }
      )
    );

    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "create_survey",
            arguments: {
              workspaceId: "clxx1234567890123456789012",
              name: "MCP QA create",
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
            },
          },
        },
        {
          "x-request-id": "req_create",
        }
      )
    );

    expect(response.status).toBe(200);
    const message = await readMcpResponse(response);
    expect(message.result.structuredContent).toEqual({
      data: { id: "clsv1234567890123456789012" },
      requestId: "req_create",
    });
    expect(createV3SurveyResponseFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: apiKeyAuth,
        requestId: "req_create",
        instance: "/api/mcp",
      })
    );
  });

  test("calls validate_survey patch through the MCP route", async () => {
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse({ valid: true, operation: "patch", invalid_params: [] }, { requestId: "req_validate" })
    );

    const response = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "validate_survey",
            arguments: {
              operation: "patch",
              surveyId: "clsv1234567890123456789012",
              data: { name: "Updated survey" },
            },
          },
        },
        {
          "x-request-id": "req_validate",
        }
      )
    );

    expect(response.status).toBe(200);
    const message = await readMcpResponse(response);
    expect(message.result.structuredContent).toEqual({
      data: { valid: true, operation: "patch", invalid_params: [] },
      requestId: "req_validate",
    });
    expect(validateV3SurveyFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          operation: "patch",
          surveyId: "clsv1234567890123456789012",
          data: { name: "Updated survey" },
        },
        authentication: apiKeyAuth,
        requestId: "req_validate",
        instance: "/api/mcp",
      })
    );
  });

  test("maps v3 create and validate bad requests to MCP tool errors", async () => {
    vi.mocked(createV3SurveyResponseFromRawInput).mockResolvedValueOnce(
      problemBadRequest("req_create_invalid", "Invalid survey document", {
        instance: "/api/mcp",
        invalid_params: [{ name: "blocks.0.elements", reason: "Required" }],
      })
    );
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValueOnce(
      problemBadRequest("req_validate_invalid", "Invalid survey validation request", {
        instance: "/api/mcp",
        invalid_params: [{ name: "surveyId", reason: "Required" }],
      })
    );

    const createResponse = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "create_survey",
            arguments: {
              workspaceId: "clxx1234567890123456789012",
              name: "Invalid create",
              blocks: [{ id: "clbk1234567890123456789012" }],
            },
          },
        },
        { "x-request-id": "req_create_invalid" }
      )
    );
    const validateResponse = await POST(
      createMcpRequest(
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: {
            name: "validate_survey",
            arguments: {
              operation: "patch",
              data: {},
            },
          },
        },
        { "x-request-id": "req_validate_invalid" }
      )
    );

    expect((await readMcpResponse(createResponse)).result.structuredContent.error).toMatchObject({
      status: 400,
      detail: "Invalid survey document",
      invalid_params: [{ name: "blocks.0.elements", reason: "Required" }],
    });
    expect((await readMcpResponse(validateResponse)).result.structuredContent.error).toMatchObject({
      status: 400,
      detail: "Invalid survey validation request",
      invalid_params: [{ name: "surveyId", reason: "Required" }],
    });
  });
});
