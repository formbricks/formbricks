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
  MCP_CHALLENGE_SCOPE,
  MCP_RESOURCE_SCOPES,
  getAuthIssuerUrl,
  getMcpOrigin,
  getMcpProtectedResourceMetadataUrl,
  getMcpResourceUrl,
  getOAuthUserInfoUrl,
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
  const scopes = new Set(["surveys:read", "workflows:read", "feedbackRecords:read"]);
  if (
    authentication.workspacePermissions.some(
      (permission) => permission.permission === "write" || permission.permission === "manage"
    )
  ) {
    scopes.add("surveys:write");
    scopes.add("workflows:write");
    scopes.add("feedbackRecords:write");
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

/** `aud` is a single string or an array (RFC 7519 §4.1.3); normalise both to a list. */
function toAudienceList(aud: JWTPayload["aud"]): string[] {
  if (typeof aud === "string") {
    return [aud];
  }

  return Array.isArray(aud) ? aud : [];
}

/**
 * Rejects an access token that was not minted for this resource server.
 *
 * `verifyOptions.audience` alone does NOT do this. It is handed to jose, whose `aud` check is a
 * *membership* test — a token carrying `aud: [".../api/mcp", "https://other.example/api"]` passes it
 * and would be accepted here, which is exactly the cross-resource escalation GHSA-p2fr-6hmx-4528
 * describes. RFC 9068 §4 puts the burden on the resource server: it must reject a token whose
 * audience is not itself, so this assert is required regardless of which provider version issued the
 * token.
 *
 * Written as an allow-list rather than "exactly one audience", deliberately. When `openid` is in the
 * granted scopes the authorization server treats its own UserInfo endpoint as an implicit second
 * resource and appends it to `aud` — that is current behaviour, not something the pending provider
 * upgrade introduces — so a perfectly ordinary MCP token is multi-valued. Those two identifiers are
 * the only ones a Formbricks-issued MCP token may carry; anything else means the token was minted
 * for somebody else and must not be honoured here.
 */
function hasAcceptedMcpAudience(payload: JWTPayload): boolean {
  const audiences = toAudienceList(payload.aud);

  const resourceUrl = getMcpResourceUrl();
  if (!audiences.includes(resourceUrl)) {
    return false;
  }

  const acceptedAudiences = new Set([resourceUrl, getOAuthUserInfoUrl()]);
  return audiences.every((audience) => acceptedAudiences.has(audience));
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
  // Comma-separated auth-params, per the `#auth-param` list grammar in RFC 9110 §11.6.1 (as used by
  // RFC 6750 and RFC 9728). Space-separated, a strict parser reads the whole tail as one malformed
  // param and misses `resource_metadata` — the pointer MCP clients follow to discover this server.
  headers.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${getMcpProtectedResourceMetadataUrl()}", scope="${scope}"`
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

/**
 * The shared refusal for a request that failed to authenticate: charge the unauthenticated rate-limit
 * bucket first (so a bad credential cannot be retried for free), then answer 401 with the discovery
 * challenge.
 *
 * `detail` is what the caller is told and defaults to the same opaque string for every OAuth failure
 * — expired, forged, wrong audience and inactive user are deliberately indistinguishable. The reason
 * lives in `logMessage`/`logContext` instead, where it is useful to us and not to an attacker.
 */
async function rejectUnauthenticatedMcpRequest(params: {
  requestId: string;
  instance: string;
  log: ReturnType<typeof logger.withContext>;
  logMessage: string;
  detail?: string;
  logContext?: Record<string, unknown>;
}): Promise<TMcpAuthenticationResult> {
  const { requestId, instance, log, logMessage, detail = "Invalid OAuth access token", logContext } = params;

  const rateLimitResponse = await rateLimitUnauthenticatedMcpRequest(requestId, log);
  if (rateLimitResponse) {
    return { ok: false, requestId, response: rateLimitResponse };
  }

  log.warn({ statusCode: 401, ...logContext }, logMessage);
  return {
    ok: false,
    requestId,
    response: withOAuthChallenge(problemUnauthorized(requestId, detail, instance)),
  };
}

async function authenticateMcpApiKey(
  request: NextRequest,
  requestId: string,
  log: ReturnType<typeof logger.withContext>
): Promise<TMcpAuthenticationResult> {
  const instance = request.nextUrl.pathname;
  const authentication = await authenticateApiKeyFromHeaders(request.headers);

  if (!authentication) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      detail: "API key or OAuth access token required",
      logMessage: "MCP API key authentication failed",
    });
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
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth authentication failed",
    });
  }

  if (!hasAcceptedMcpAudience(payload)) {
    // Logged distinctly — a token that verifies against our own issuer and JWKS but names a
    // different audience is a resource-confusion attempt, not the routine expired/garbage token the
    // catch above handles.
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth token audience is not bound to this resource server",
      logContext: { clientId: getOAuthClientId(payload), audience: payload.aud },
    });
  }

  const authInfo = createOAuthMcpAuthInfo(payload, requestId);

  if (!authInfo) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      detail: "User OAuth access token required",
      logMessage: "MCP OAuth token has no user subject",
    });
  }

  const sessionAuthentication = authInfo.extra.formbricksAuthentication as Session;
  if (!(await isOAuthUserActive(sessionAuthentication.user.id))) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth token user is inactive",
      logContext: { clientId: authInfo.clientId },
    });
  }

  // Minimum grant required to authenticate against the MCP server at all: at least ONE *resource*
  // scope. Any single one is enough — a token granted only `feedbackRecords:read` is a legitimate
  // MCP client and must not be rejected here for lacking `surveys:read`. Which tools it can actually
  // call is enforced per-tool by guardMcpScopes at call time.
  //
  // Deliberately NOT MCP_CHALLENGE_SCOPE / MCP_PROTECTED_RESOURCE_SCOPES: those include
  // `offline_access`, and an any-of gate over that list would let a token holding *only*
  // `offline_access` — which grants no resource access at all — authenticate to the MCP server.
  // Same reason the insufficient_scope challenge below advertises only the resource scopes: RFC 6750
  // `scope` names the scopes *required* for the resource, and `offline_access` is not one of them.
  if (!hasAnyMcpScope(authInfo, MCP_RESOURCE_SCOPES)) {
    log.warn({ statusCode: 403, clientId: authInfo.clientId }, "MCP OAuth token missing every MCP scope");
    return {
      ok: false,
      requestId,
      response: withInsufficientScopeChallenge(
        problemForbidden(requestId, "OAuth token does not include the required MCP scope", instance),
        [...MCP_RESOURCE_SCOPES]
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

/** True when the caller holds at least one of `allowedScopes` (any-of, unlike `hasMcpScopes`). */
export function hasAnyMcpScope(authInfo: AuthInfo | undefined, allowedScopes: readonly string[]): boolean {
  const scopes = authInfo?.scopes ?? [];
  return allowedScopes.some((scope) => scopes.includes(scope));
}

/**
 * The scopes are named in `detail`, not only in the `WWW-Authenticate` challenge, because the tool path
 * cannot carry a header: `guardMcpScopes` hands this Response to `responseToMcpToolResult`, which
 * serializes the JSON body into a JSON-RPC result and drops every header. Without them in the body a
 * client that is refused a tool call learns only "some scope is missing" and cannot re-authorize for the
 * right one. The challenge is still set for the transport-level 403, where the header does reach clients.
 */
export function createMcpInsufficientScopeResponse(requestId: string, scopes: string[]): Response {
  return withInsufficientScopeChallenge(
    problemForbidden(
      requestId,
      `OAuth token does not include the required MCP scope: ${scopes.join(" ")}`,
      "/api/mcp"
    ),
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
      return await rejectUnauthenticatedMcpRequest({
        requestId,
        instance,
        log,
        detail: "API key or OAuth access token required",
        logMessage: "MCP authentication credentials missing",
      });
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
