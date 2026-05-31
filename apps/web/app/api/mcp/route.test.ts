import { ApiKeyPermission } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import { successListResponse } from "@/app/api/v3/lib/response";
import { listV3Surveys } from "@/app/api/v3/surveys/lib/operations";
import { authenticateApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { POST } from "./route";

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  createV3SurveyResponse: vi.fn(),
  deleteV3Survey: vi.fn(),
  getV3Survey: vi.fn(),
  listV3Surveys: vi.fn(),
  validateV3Survey: vi.fn(),
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
    vi.mocked(applyRateLimit).mockResolvedValue(undefined);
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
      "delete_survey",
    ]);
    expect(message.result.tools.find((tool: { name: string }) => tool.name === "list_surveys")).toMatchObject({
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
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
});
