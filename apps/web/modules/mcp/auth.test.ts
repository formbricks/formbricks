import { ApiKeyPermission } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import {
  authenticateMcpRequest,
  getMcpAuthentication,
  getMcpRequestId,
  handleAuthenticatedMcpRequest,
} from "./auth";

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
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
      workspaceId: "workspace_1",
      workspaceName: "Workspace",
      permission: ApiKeyPermission.write,
    },
  ],
};

function createRequest(url = "http://localhost/api/mcp", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers,
  });
}

describe("authenticateMcpRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(applyRateLimit).mockResolvedValue(undefined);
  });

  test("returns 401 when no API key authenticates", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(null);

    const result = await authenticateMcpRequest(createRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toMatchObject({
        code: "not_authenticated",
        detail: "API key required",
      });
    }
  });

  test("rejects API keys in query parameters", async () => {
    const result = await authenticateMcpRequest(createRequest("http://localhost/api/mcp?apiKey=secret"));

    expect(result.ok).toBe(false);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.invalid_params[0].name).toBe("query");
    }
  });

  test("rejects cross-origin browser requests", async () => {
    const result = await authenticateMcpRequest(
      createRequest("http://app.example.com/api/mcp", {
        origin: "https://evil.example.com",
        host: "app.example.com",
      })
    );

    expect(result.ok).toBe(false);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  test("returns auth info for a valid API key and rate limits by API key id", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(apiKeyAuth);

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        "x-request-id": "req_1",
        "x-api-key": "fbk_test",
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requestId).toBe("req_1");
      expect(result.authInfo.clientId).toBe("key_1");
      expect(result.authInfo.token).toBe("key_1");
      expect(getMcpAuthentication(result.authInfo)).toEqual(apiKeyAuth);
      expect(getMcpRequestId(result.authInfo)).toBe("req_1");
    }
    expect(applyRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:v3" }), "key_1");
  });

  test("returns 429 when rate limited", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(apiKeyAuth);
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Too many requests", 30));

    const result = await authenticateMcpRequest(createRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("30");
    }
  });
});

describe("handleAuthenticatedMcpRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(applyRateLimit).mockResolvedValue(undefined);
  });

  test("attaches MCP auth info and request headers to handler response", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(apiKeyAuth);
    const handler = vi.fn(async (request: Request & { auth?: unknown }) => {
      expect(request.auth).toMatchObject({
        clientId: "key_1",
      });
      return Response.json({ ok: true });
    });

    const response = await handleAuthenticatedMcpRequest(
      createRequest("http://localhost/api/mcp", {
        "x-request-id": "req_2",
        "x-api-key": "fbk_test",
      }),
      handler
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req_2");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true });
  });
});
