import { SignJWT, generateKeyPair, jwtVerify } from "jose";
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

const { verifyBearerTokenMock, userFindUniqueMock } = vi.hoisted(() => ({
  verifyBearerTokenMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@better-auth/oauth-provider/resource-client", () => ({
  oauthProviderResourceClient: vi.fn(() => ({
    getActions: () => ({
      verifyBearerToken: verifyBearerTokenMock,
    }),
  })),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    // This file's mock replaces the global one in vitestSetup, so it needs its own no-op
    // `oauthResource`: Better Auth 1.7 seeds resources when the oauthProvider plugin initialises,
    // which importing ./auth triggers, and without it the adapter throws an unhandled
    // `Model oauthResource does not exist in the database` alongside a passing suite.
    oauthResource: {
      findMany: () => Promise.resolve([]),
      findFirst: () => Promise.resolve(null),
      findUnique: () => Promise.resolve(null),
      create: (args: { data: unknown }) => Promise.resolve(args.data),
      createMany: () => Promise.resolve({ count: 0 }),
      update: (args: { data: unknown }) => Promise.resolve(args.data),
      upsert: (args: { create: unknown }) => Promise.resolve(args.create),
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

// Only the env-dependent URL getters are stubbed; the scope constants come from the real module.
// Re-declaring them here would assert the mock against itself and mask scope drift — which is how
// the challenge list silently diverged from the protected-resource metadata (ENG-2175).
vi.mock("@/modules/auth/lib/oauth-urls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/oauth-urls")>()),
  getAuthIssuerUrl: vi.fn(() => "https://app.example.com/api/auth"),
  getMcpOrigin: vi.fn(() => "https://app.example.com"),
  getMcpProtectedResourceMetadataUrl: vi.fn(
    () => "https://app.example.com/.well-known/oauth-protected-resource/api/mcp"
  ),
  getMcpResourceUrl: vi.fn(() => "https://app.example.com/api/mcp"),
  getOAuthUserInfoUrl: vi.fn(() => "https://app.example.com/api/auth/oauth2/userinfo"),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Imported dynamically so it resolves against the partially-mocked module above rather than being
// hoisted past it.
const { MCP_CHALLENGE_SCOPE } = await import("@/modules/auth/lib/oauth-urls");

// Two comma-separated quoted auth-params, per the `#auth-param` list grammar in RFC 9110 §11.6.1 (#8718).
// Cases that care about the challenge's *shape* assert this rather than the whole string, so they do not
// have to be rewritten every time the advertised scope list changes; the exact value is pinned once, from
// the real constant, in app/api/mcp/route.test.ts.
const CHALLENGE_GRAMMAR = /^Bearer resource_metadata="[^"]+", scope="[^"]+"$/;

// Every mocked payload below carries `aud`, because every real token does — the authorization server
// always stamps the resource a token was minted for. A fixture without it would sail past the
// audience binding that production tokens have to satisfy, and the suite would be asserting against a
// token shape that cannot exist.
const MCP_AUDIENCE = "https://app.example.com/api/mcp";
// The AS's own UserInfo endpoint, which it adds to `aud` as an implicit second resource whenever
// `openid` is in scope. Derived from the mocked issuer above.
const USERINFO_AUDIENCE = "https://app.example.com/api/auth/oauth2/userinfo";

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
    verifyBearerTokenMock.mockReset();
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
      // The challenge must advertise every resource scope so clients request them at consent and can
      // reach the write tools (advertising only read is why write was unreachable — ENG-1055 QA),
      // plus offline_access so a client that registers from this string can still be granted a
      // refresh token (ENG-2175). Asserted against the real constant, not a literal.
      expect(result.response.headers.get("WWW-Authenticate")).toContain(`scope="${MCP_CHALLENGE_SCOPE}"`);
      expect(MCP_CHALLENGE_SCOPE).toContain("offline_access");
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
      // A write-capable key must reach both tool groups' read AND write tools.
      expect(result.authInfo.scopes).toEqual(
        expect.arrayContaining([
          "surveys:read",
          "surveys:write",
          "feedbackRecords:read",
          "feedbackRecords:write",
        ])
      );
    }
    expect(applyRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:v3" }), "key_1");
  });

  test("grants only read scopes to a read-only API key", async () => {
    vi.mocked(authenticateApiKeyFromHeaders).mockResolvedValue({
      ...apiKeyAuth,
      workspacePermissions: [
        { workspaceId: "workspace_1", workspaceName: "Workspace", permission: ApiKeyPermission.read },
      ],
    });

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", { "x-api-key": "fbk_test" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authInfo.scopes).toEqual(["surveys:read", "workflows:read", "feedbackRecords:read"]);
    }
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
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
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
    // Exact equality on purpose: this is the canary for the verify options drifting. `typ` pins the
    // RFC 9068 access-token type, enforceable from Better Auth 1.7 (1.6 emitted no typ header).
    expect(verifyBearerTokenMock).toHaveBeenCalledWith("oauth_access_token", {
      verifyOptions: {
        audience: "https://app.example.com/api/mcp",
        issuer: "https://app.example.com/api/auth",
        typ: "at+jwt",
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
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
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
      // Auth-params are comma-separated (RFC 9110 `#auth-param`), so a strict client parser can read
      // `resource_metadata` out of the challenge instead of choking on the whole tail. What this case is
      // really about is the metadata URL being built from the configured origin, so assert that plus the
      // grammar — not the scope list, which is pinned from the real constant elsewhere.
      const challenge = result.response.headers.get("WWW-Authenticate");
      expect(challenge).toMatch(CHALLENGE_GRAMMAR);
      expect(challenge).toContain(
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

  test("rejects OAuth bearer tokens holding no MCP resource scope at all", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
      sub: "user_1",
      client_id: "client_2",
      scope: "openid profile email",
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
      // Deliberately the RESOURCE scopes, not the challenge scope: RFC 6750 `scope` names what the
      // resource requires, and offline_access is not one of those. If this ever needs offline_access
      // added, the baseline auth gate has been widened and MCP is accepting a token that grants no
      // resource access.
      expect(result.response.headers.get("WWW-Authenticate")).toContain(
        'scope="surveys:read surveys:write workflows:read workflows:write feedbackRecords:read feedbackRecords:write"'
      );
    }
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  // The inverse of the challenge fix: offline_access is advertised so clients can obtain a refresh
  // token, but it grants no resource access, so it must never satisfy the baseline gate on its own.
  test("rejects an OAuth bearer token scoped only to offline_access", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
      sub: "user_1",
      client_id: "client_2",
      scope: "openid profile email offline_access",
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
    }
  });

  // Any single resource scope is enough to authenticate: a feedbackRecords-only grant is a legitimate
  // MCP client and must not be turned away for lacking surveys:read (per-tool guards still apply).
  test.each([["feedbackRecords:read"], ["surveys:write"]])(
    "authenticates an OAuth token scoped only to %s",
    async (scope) => {
      verifyBearerTokenMock.mockResolvedValue({ aud: MCP_AUDIENCE, sub: "user_1", azp: "client_1", scope });

      const result = await authenticateMcpRequest(
        createRequest("http://localhost/api/mcp", {
          authorization: "Bearer oauth_access_token",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.authInfo.scopes).toEqual([scope]);
      }
    }
  );

  // Verification is stubbed here, so these two exercise the resource server's audience check on its
  // own — with no jose `aud` enforcement upstream of it. That is not a contrived setup: the 1.7
  // provider drops `verifyOptions.audience` from its own verification, at which point this check is
  // the only thing standing between a foreign-audience token and the MCP tools.
  test("rejects an OAuth token whose audience omits the MCP resource, independently of jose", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: "https://other.example.com/api",
      sub: "user_1",
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
      expect(await result.response.json()).toMatchObject({ detail: "Invalid OAuth access token" });
    }
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("returns 429 when audience-rejected tokens exceed the unauthenticated MCP rate limit", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: [MCP_AUDIENCE, "https://other.example.com/api"],
      sub: "user_1",
      azp: "client_1",
      scope: "surveys:read",
    });
    vi.mocked(applyIPRateLimit).mockRejectedValue(new TooManyRequestsError("Too many auth requests", 45));

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("45");
    }
  });

  test("rejects OAuth bearer tokens without a user subject", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
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
    verifyBearerTokenMock.mockRejectedValue(new Error("Invalid token"));

    const result = await authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: "Bearer oauth_access_token",
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      // Auth-params are comma-separated (RFC 9110 `#auth-param`), so a strict client parser can read
      // `resource_metadata` out of the challenge instead of choking on the whole tail. What this case is
      // really about is the metadata URL being built from the configured origin, so assert that plus the
      // grammar — not the scope list, which is pinned from the real constant elsewhere.
      const challenge = result.response.headers.get("WWW-Authenticate");
      expect(challenge).toMatch(CHALLENGE_GRAMMAR);
      expect(challenge).toContain(
        'resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"'
      );
      expect(await result.response.json()).toMatchObject({
        detail: "Invalid OAuth access token",
      });
    }
    expect(applyIPRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:mcp:auth" }));
  });

  test("returns 429 when OAuth requests are rate limited", async () => {
    verifyBearerTokenMock.mockResolvedValue({
      aud: MCP_AUDIENCE,
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

// GHSA-p2fr-6hmx-4528. Everywhere else in this file `verifyAccessToken` is stubbed with a payload,
// which cannot show whether a token is really accepted — the audience rule lives in jose's semantics,
// not in a fixture. Here the stub does what the real resource client does (hand the token to jose with
// the production `verifyOptions`), and the tokens are genuinely signed, so these cases exercise the
// actual verification path.
describe("MCP OAuth access token audience binding", () => {
  const ISSUER = "https://app.example.com/api/auth";
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    userFindUniqueMock.mockResolvedValue({ isActive: true });
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true });

    keyPair = await generateKeyPair("ES256");
    verifyBearerTokenMock.mockImplementation(
      async (token: string, opts: { verifyOptions: { audience: string; issuer: string } }) =>
        (await jwtVerify(token, keyPair.publicKey, opts.verifyOptions)).payload
    );
  });

  async function signAccessToken(aud: string | string[] | undefined): Promise<string> {
    const token = new SignJWT({ scope: "surveys:read", azp: "client_1" })
      // `typ: at+jwt` is what Better Auth 1.7 stamps on an access token (RFC 9068 §2.1), and the
      // resource server now requires it — so the fixtures have to carry it to stay realistic.
      .setProtectedHeader({ alg: "ES256", typ: "at+jwt" })
      .setIssuer(ISSUER)
      .setSubject("user_1")
      .setIssuedAt()
      .setExpirationTime("15m");

    if (aud !== undefined) {
      token.setAudience(aud);
    }

    return token.sign(keyPair.privateKey);
  }

  async function authenticateWithAudience(aud: string | string[] | undefined) {
    return authenticateMcpRequest(
      createRequest("http://localhost/api/mcp", {
        authorization: `Bearer ${await signAccessToken(aud)}`,
      })
    );
  }

  test("accepts a token minted for the MCP resource", async () => {
    const result = await authenticateWithAudience(MCP_AUDIENCE);

    expect(result.ok).toBe(true);
  });

  test("accepts a single-element audience array", async () => {
    const result = await authenticateWithAudience([MCP_AUDIENCE]);

    expect(result.ok).toBe(true);
  });

  // Not a hypothetical, and not a future shape either: the provider already appends its own UserInfo
  // endpoint to `aud` whenever `openid` is in the granted scopes (`checkResource` does it today, and
  // the 1.7 resource model keeps the behaviour). `openid` leads MCP_OAUTH_SCOPES and every
  // DCR-registered client gets it, so a rule of "exactly one audience" would reject ordinary tokens
  // right now — which is why the check is an allow-list.
  test("accepts the MCP resource alongside the authorization server's UserInfo endpoint", async () => {
    const result = await authenticateWithAudience([MCP_AUDIENCE, USERINFO_AUDIENCE]);

    expect(result.ok).toBe(true);
  });

  test("rejects a token that also names a foreign resource server", async () => {
    const foreignAudience = [MCP_AUDIENCE, "https://other.example.com/api"];

    // The vulnerability, made explicit: handed the exact options production passes, jose accepts this
    // token, because its `aud` check asks whether our identifier is *present*, not whether it is the
    // only one. Nothing in the library layer stands between this token and the MCP tools.
    await expect(
      jwtVerify(await signAccessToken(foreignAudience), keyPair.publicKey, {
        audience: MCP_AUDIENCE,
        issuer: ISSUER,
      })
    ).resolves.toBeDefined();

    const result = await authenticateWithAudience(foreignAudience);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      // Same opaque refusal as any other bad token — the caller learns nothing about why.
      expect(await result.response.json()).toMatchObject({ detail: "Invalid OAuth access token" });
    }
    expect(applyIPRateLimit).toHaveBeenCalledWith(expect.objectContaining({ namespace: "api:mcp:auth" }));
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("rejects a token minted for a different resource server", async () => {
    const result = await authenticateWithAudience("https://other.example.com/api");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  test("rejects a token carrying no audience at all", async () => {
    const result = await authenticateWithAudience(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});
