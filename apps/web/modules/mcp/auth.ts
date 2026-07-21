import "server-only";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { JWTPayload } from "jose";
import type { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { Session, TAuthenticationApiKey } from "@formbricks/types/auth";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemTooManyRequests,
  problemUnauthorized,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { parseApiKeyV2 } from "@/lib/crypto";
import { authenticateApiKeyFromHeaders, getBearerTokenFromHeaders } from "@/modules/api/lib/api-key-auth";
import { auth } from "@/modules/auth/lib/auth";
import {
  MCP_RESOURCE_SCOPES,
  getAuthIssuerUrl,
  getMcpOrigin,
  getMcpProtectedResourceMetadataUrl,
  getMcpResourceUrl,
} from "@/modules/auth/lib/oauth-urls";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const QUERY_CREDENTIAL_PARAMS = new Set([
  "api_key",
  "apikey",
  "x-api-key",
  "access_token",
  "token",
  "authorization",
]);

// Minimum scope required to authenticate against the MCP server at all.
const DEFAULT_OAUTH_SCOPE = "surveys:read";
// Scopes advertised in the 401 WWW-Authenticate challenge. Clients build their DCR + authorize
// requests from this, so it must list every resource scope (read + write) or clients only ever
// request read and can never reach the write tools. Actual write access is still gated downstream
// by the user's workspace permissions in the v3 layer.
const MCP_CHALLENGE_SCOPE = MCP_RESOURCE_SCOPES.join(" ");
const oauthResourceClient = oauthProviderResourceClient(auth);

export type TMcpAuthInfo = AuthInfo & {
  extra: {
    formbricksAuthentication: TV3Authentication;
    requestId: string;
    authMethod: "apiKey" | "oauth";
  };
};

type TMcpAuthenticationResult =
  | {
      ok: true;
      authInfo: TMcpAuthInfo;
      requestId: string;
    }
  | {
      ok: false;
      response: Response;
      requestId: string;
    };

function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function getPublicOrigin(): string {
  return getMcpOrigin();
}

function hasQueryCredentials(searchParams: URLSearchParams): boolean {
  return Array.from(searchParams.keys()).some((param) => QUERY_CREDENTIAL_PARAMS.has(param.toLowerCase()));
}

function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === getPublicOrigin();
  } catch {
    return false;
  }
}

function getMcpScopes(authentication: TAuthenticationApiKey): string[] {
  const scopes = new Set(["surveys:read"]);
  if (
    authentication.workspacePermissions.some(
      (permission) => permission.permission === "write" || permission.permission === "manage"
    )
  ) {
    scopes.add("surveys:write");
  }

  return Array.from(scopes);
}

function createApiKeyMcpAuthInfo(authentication: TAuthenticationApiKey, requestId: string): TMcpAuthInfo {
  return {
    token: authentication.apiKeyId,
    clientId: authentication.apiKeyId,
    scopes: getMcpScopes(authentication),
    extra: {
      formbricksAuthentication: authentication,
      requestId,
      authMethod: "apiKey",
    },
  };
}

function getOAuthScopes(payload: JWTPayload): string[] {
  return typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
}

function getOAuthClientId(payload: JWTPayload): string | null {
  const azp = payload.azp;
  if (typeof azp === "string" && azp.length > 0) {
    return azp;
  }

  const clientId = payload.client_id;
  return typeof clientId === "string" && clientId.length > 0 ? clientId : null;
}

function payloadToSession(payload: JWTPayload): Session | null {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return null;
  }

  const expires =
    typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? new Date(payload.exp * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    user: {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    },
    expires,
  };
}

function createOAuthMcpAuthInfo(payload: JWTPayload, requestId: string): TMcpAuthInfo | null {
  const authentication = payloadToSession(payload);
  if (!authentication) {
    return null;
  }

  const clientId = getOAuthClientId(payload) ?? "unknown";
  return {
    token: `oauth:${authentication.user.id}:${clientId}`,
    clientId,
    scopes: getOAuthScopes(payload),
    extra: {
      formbricksAuthentication: authentication,
      requestId,
      authMethod: "oauth",
    },
  };
}

async function isOAuthUserActive(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  return user?.isActive === true;
}

export function getMcpAuthentication(authInfo?: AuthInfo): TV3Authentication {
  const authentication = authInfo?.extra?.formbricksAuthentication;
  if (!authentication || typeof authentication !== "object") {
    return null;
  }

  return authentication as TV3Authentication;
}

export function getMcpRequestId(authInfo?: AuthInfo): string {
  const requestId = authInfo?.extra?.requestId;
  return typeof requestId === "string" && requestId.length > 0 ? requestId : crypto.randomUUID();
}

export function withMcpResponseHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withOAuthChallenge(response: Response, scope = MCP_CHALLENGE_SCOPE): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${getMcpProtectedResourceMetadataUrl()}" scope="${scope}"`
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withInsufficientScopeChallenge(response: Response, scopes: string[]): Response {
  const headers = new Headers(response.headers);
  const requiredScopes = scopes.join(" ");
  headers.set(
    "WWW-Authenticate",
    [
      'Bearer error="insufficient_scope"',
      `scope="${requiredScopes}"`,
      `resource_metadata="${getMcpProtectedResourceMetadataUrl()}"`,
      'error_description="The OAuth access token does not include the required MCP scope."',
    ].join(", ")
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function rateLimitUnauthenticatedMcpRequest(
  requestId: string,
  log: ReturnType<typeof logger.withContext>
): Promise<Response | null> {
  try {
    await applyIPRateLimit(rateLimitConfigs.api.mcpAuth);
    return null;
  } catch (error) {
    log.warn({ error, statusCode: 429 }, "MCP unauthenticated rate limit exceeded");
    return problemTooManyRequests(
      requestId,
      error instanceof Error ? error.message : "Rate limit exceeded",
      error instanceof TooManyRequestsError ? error.retryAfter : undefined
    );
  }
}

async function authenticateMcpApiKey(
  request: NextRequest,
  requestId: string,
  log: ReturnType<typeof logger.withContext>
): Promise<TMcpAuthenticationResult> {
  const instance = request.nextUrl.pathname;
  const authentication = await authenticateApiKeyFromHeaders(request.headers);

  if (!authentication) {
    const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
    if (rateLimitResponse) {
      return { ok: false, requestId, response: rateLimitResponse };
    }

    log.warn({ statusCode: 401 }, "MCP API key authentication failed");
    return {
      ok: false,
      requestId,
      response: withOAuthChallenge(
        problemUnauthorized(requestId, "API key or OAuth access token required", instance)
      ),
    };
  }

  try {
    await applyRateLimit(rateLimitConfigs.api.v3, authentication.apiKeyId);
  } catch (error) {
    log.warn({ error, statusCode: 429, apiKeyId: authentication.apiKeyId }, "MCP API rate limit exceeded");
    return {
      ok: false,
      requestId,
      response: problemTooManyRequests(
        requestId,
        error instanceof Error ? error.message : "Rate limit exceeded",
        error instanceof TooManyRequestsError ? error.retryAfter : undefined
      ),
    };
  }

  return {
    ok: true,
    requestId,
    authInfo: createApiKeyMcpAuthInfo(authentication, requestId),
  };
}

async function authenticateMcpOAuthBearer(
  token: string,
  requestId: string,
  instance: string,
  log: ReturnType<typeof logger.withContext>
): Promise<TMcpAuthenticationResult> {
  let payload: JWTPayload;

  try {
    payload = await oauthResourceClient.getActions().verifyAccessToken(token, {
      verifyOptions: {
        audience: getMcpResourceUrl(),
        issuer: getAuthIssuerUrl(),
      },
      jwksUrl: `${getAuthIssuerUrl()}/jwks`,
    });
  } catch {
    const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
    if (rateLimitResponse) {
      return { ok: false, requestId, response: rateLimitResponse };
    }

    log.warn({ statusCode: 401 }, "MCP OAuth authentication failed");
    return {
      ok: false,
      requestId,
      response: withOAuthChallenge(problemUnauthorized(requestId, "Invalid OAuth access token", instance)),
    };
  }

  const authInfo = createOAuthMcpAuthInfo(payload, requestId);

  if (!authInfo) {
    const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
    if (rateLimitResponse) {
      return { ok: false, requestId, response: rateLimitResponse };
    }

    log.warn({ statusCode: 401 }, "MCP OAuth token has no user subject");
    return {
      ok: false,
      requestId,
      response: withOAuthChallenge(
        problemUnauthorized(requestId, "User OAuth access token required", instance)
      ),
    };
  }

  const sessionAuthentication = authInfo.extra.formbricksAuthentication as Session;
  if (!(await isOAuthUserActive(sessionAuthentication.user.id))) {
    const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
    if (rateLimitResponse) {
      return { ok: false, requestId, response: rateLimitResponse };
    }

    log.warn({ statusCode: 401, clientId: authInfo.clientId }, "MCP OAuth token user is inactive");
    return {
      ok: false,
      requestId,
      response: withOAuthChallenge(problemUnauthorized(requestId, "Invalid OAuth access token", instance)),
    };
  }

  if (!hasMcpScopes(authInfo, [DEFAULT_OAUTH_SCOPE])) {
    log.warn({ statusCode: 403, clientId: authInfo.clientId }, "MCP OAuth token missing read scope");
    return {
      ok: false,
      requestId,
      response: withInsufficientScopeChallenge(
        problemForbidden(requestId, "OAuth token does not include the required MCP scope", instance),
        [DEFAULT_OAUTH_SCOPE]
      ),
    };
  }

  try {
    await applyRateLimit(
      rateLimitConfigs.api.v3,
      `oauth:${sessionAuthentication.user.id}:${authInfo.clientId}`
    );
  } catch (error) {
    log.warn({ error, statusCode: 429, clientId: authInfo.clientId }, "MCP OAuth rate limit exceeded");
    return {
      ok: false,
      requestId,
      response: problemTooManyRequests(
        requestId,
        error instanceof Error ? error.message : "Rate limit exceeded",
        error instanceof TooManyRequestsError ? error.retryAfter : undefined
      ),
    };
  }

  return {
    ok: true,
    requestId,
    authInfo,
  };
}

export function hasMcpScopes(authInfo: AuthInfo | undefined, requiredScopes: string[]): boolean {
  const scopes = authInfo?.scopes ?? [];
  return requiredScopes.every((scope) => scopes.includes(scope));
}

export function createMcpInsufficientScopeResponse(requestId: string, scopes: string[]): Response {
  return withInsufficientScopeChallenge(
    problemForbidden(requestId, "OAuth token does not include the required MCP scope", "/api/mcp"),
    scopes
  );
}

export async function authenticateMcpRequest(request: NextRequest): Promise<TMcpAuthenticationResult> {
  const requestId = getRequestId(request);
  const instance = request.nextUrl.pathname;
  const log = logger.withContext({ requestId, path: instance, method: request.method });

  if (hasQueryCredentials(request.nextUrl.searchParams)) {
    log.warn({ statusCode: 400 }, "MCP API key supplied in query parameters");
    return {
      ok: false,
      requestId,
      response: problemBadRequest(requestId, "API keys must be sent in headers, not query parameters", {
        instance,
        invalid_params: [
          {
            name: "query",
            reason: "Send the API key with x-api-key or Authorization: Bearer.",
          },
        ],
      }),
    };
  }

  if (!isOriginAllowed(request)) {
    log.warn({ statusCode: 403, origin: request.headers.get("origin") }, "MCP origin validation failed");
    return {
      ok: false,
      requestId,
      response: problemForbidden(requestId, "Cross-origin MCP requests are not allowed", instance),
    };
  }

  try {
    const xApiKey = request.headers.get("x-api-key")?.trim();
    if (xApiKey) {
      return await authenticateMcpApiKey(request, requestId, log);
    }

    const bearerToken = getBearerTokenFromHeaders(request.headers);
    if (!bearerToken) {
      const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
      if (rateLimitResponse) {
        return { ok: false, requestId, response: rateLimitResponse };
      }

      log.warn({ statusCode: 401 }, "MCP authentication credentials missing");
      return {
        ok: false,
        requestId,
        response: withOAuthChallenge(
          problemUnauthorized(requestId, "API key or OAuth access token required", instance)
        ),
      };
    }

    if (parseApiKeyV2(bearerToken)) {
      return await authenticateMcpApiKey(request, requestId, log);
    }

    return await authenticateMcpOAuthBearer(bearerToken, requestId, instance, log);
  } catch (error) {
    log.error({ error, statusCode: 500 }, "MCP API authentication unexpected error");
    return {
      ok: false,
      requestId,
      response: problemInternalError(requestId, "An unexpected error occurred.", instance),
    };
  }
}

export async function handleAuthenticatedMcpRequest(
  request: NextRequest,
  handler: (request: Request) => Promise<Response>
): Promise<Response> {
  const authResult = await authenticateMcpRequest(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  (request as Request & { auth?: AuthInfo }).auth = authResult.authInfo;
  const response = await handler(request);
  return withMcpResponseHeaders(response, authResult.requestId);
}
