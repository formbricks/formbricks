import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import {
  authenticateMcpRequest,
  getMcpAuthentication,
  getMcpRequestId,
  handleAuthenticatedMcpRequest,
} from "./auth";

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

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: vi.fn(),
  getBearerTokenFromHeaders: vi.fn((headers: Headers) => {
    const authorization = headers.get("authorization");
    return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  }),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/auth/lib/oauth-urls", () => ({
  MCP_OAUTH_SCOPES: ["openid", "profile", "email", "offline_access", "surveys:read", "surveys:write"],
  MCP_RESOURCE_SCOPES: ["surveys:read", "surveys:write"],
  getAuthIssuerUrl: vi.fn(() => "https://app.example.com/api/auth"),
  getMcpOrigin: vi.fn(() => "https://app.example.com"),
  getMcpProtectedResourceMetadataUrl: vi.fn(
    () => "https://app.example.com/.well-known/oauth-protected-resource/api/mcp"
  ),
  getMcpResourceUrl: vi.fn(() => "https://app.example.com/api/mcp"),
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
    vi.clearAllMocks();
    verifyAccessTokenMock.mockReset();
    userFindUniqueMock.mockResolvedValue({ isActive: true });
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
  });

  test("returns 401 when no API key authenticates", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(null);

    const result = await authenticateMcpRequest(createRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      // The challenge must advertise read + write so clients request write at consent and can reach
      // the write tools (advertising only read is why write was unreachable — ENG-1055 QA).
      expect(result.response.headers.get("WWW-Authenticate")).toContain('scope="surveys:read surveys:write"');
      expect(await result.response.json()).toMatchObject({
        code: "not_authenticated",
        detail: "API key or OAuth access token required",
      });
    }
  });

  test("returns 429 when missing credentials exceed the unauthenticated MCP rate limit", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(new TooManyRequestsError("Too many auth requests", 45));

    const result = await authenticateMcpRequest(createRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("45");
    }
    expect(applyRateLimit).not.toHaveBeenCalled();
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

  test("rejects query credential parameters case-insensitively", async () => {
    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp?Authorization=Bearer%20secret")
    );

    expect(result.ok).toBe(false);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  test("rejects cross-origin browser requests", async () => {
    const result = await authenticateMcpRequest(
      createRequest("https://app.example.com/api/mcp", {
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

  test("does not trust forwarded host headers for origin validation", async () => {
    const result = await authenticateMcpRequest(
      createRequest("https://app.example.com/api/mcp", {
        origin: "https://evil.example.com",
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "https",
      })
    );

    expect(result.ok).toBe(false);
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  test("allows the configured public origin", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue(apiKeyAuth);

    const result = await authenticateMcpRequest(
      createRequest("http://internal.local/api/mcp", {
        origin: "https://app.example.com",
        "x-api-key": "fbk_test",
      })
    );

    expect(result.ok).toBe(true);
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

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        "x-api-key": "fbk_test",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("30");
    }
  });

  test("authenticates OAuth bearer tokens and rate limits by user and client", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user_1",
      email: "user@example.com",
      name: "Test User",
      exp: 2_000_000_000,
      azp: "client_1",
      scope: "openid profile email surveys:read surveys:write",
    });

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
        "x-request-id": "req_oauth",
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authInfo.clientId).toBe("client_1");
      expect(result.authInfo.scopes).toEqual(["openid", "profile", "email", "surveys:read", "surveys:write"]);
      expect(result.authInfo.extra.authMethod).toBe("oauth");
      expect(getMcpAuthentication(result.authInfo)).toMatchObject({
        user: {
          id: "user_1",
          email: "user@example.com",
          name: "Test User",
        },
      });
    }
    expect(authenticateApiKeyFromHeaders).not.toHaveBeenCalled();
    expect(verifyAccessTokenMock).toHaveBeenCalledWith("oauth_access_token", {
      verifyOptions: {
        audience: "https://app.example.com/api/mcp",
        issuer: "https://app.example.com/api/auth",
      },
      jwksUrl: "https://app.example.com/api/auth/jwks",
    });
    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { isActive: true },
    });
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3" }),
      "oauth:user_1:client_1"
    );
  });

  test("rejects OAuth bearer tokens for inactive users", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user_1",
      azp: "client_1",
      scope: "surveys:read surveys:write",
    });
    userFindUniqueMock.mockResolvedValue({ isActive: false });

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get("WWW-Authenticate")).toContain(
        'resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"'
      );
      expect(await result.response.json()).toMatchObject({
        detail: "Invalid OAuth access token",
      });
    }
    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { isActive: true },
    });
    expect(applyIPRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:mcp:auth" }));
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("rejects OAuth bearer tokens without the read scope", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user_1",
      client_id: "client_2",
      scope: "surveys:write",
    });

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(result.response.headers.get("WWW-Authenticate")).toContain('error="insufficient_scope"');
      expect(result.response.headers.get("WWW-Authenticate")).toContain('scope="surveys:read"');
    }
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("rejects OAuth bearer tokens without a user subject", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      azp: "client_1",
      scope: "surveys:read",
    });

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toMatchObject({
        detail: "User OAuth access token required",
      });
    }
    expect(applyIPRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:mcp:auth" }));
  });

  test("rejects invalid OAuth bearer tokens with an OAuth challenge", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("Invalid token"));

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get("WWW-Authenticate")).toContain(
        'resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"'
      );
      expect(await result.response.json()).toMatchObject({
        detail: "Invalid OAuth access token",
      });
    }
    expect(applyIPRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:mcp:auth" }));
  });

  test("returns 429 when OAuth requests are rate limited", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user_1",
      azp: "client_1",
      scope: "surveys:read",
    });
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Too many requests", 30));

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("30");
    }
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3" }),
      "oauth:user_1:client_1"
    );
  });
});

describe("handleAuthenticatedMcpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });
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
