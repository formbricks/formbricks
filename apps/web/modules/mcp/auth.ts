import "server-only";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { AuthInfo, ServerContext } from "@modelcontextprotocol/server";
import { getJwks } from "better-auth/oauth2";
import { type JWTPayload, createLocalJWKSet, decodeProtectedHeader } from "jose";
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
import { type TAuthorizationMcpGrant, withAuthorizationSurface } from "@/lib/authorization/context";
import { parseApiKeyV2 } from "@/lib/crypto";
import { hasOnlyDashboardViewerRoles } from "@/lib/membership/dashboard-viewer";
import { authenticateApiKeyFromHeaders, getBearerTokenFromHeaders } from "@/modules/api/lib/api-key-auth";
import { auth } from "@/modules/auth/lib/auth";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import {
  MCP_CHALLENGE_SCOPE,
  MCP_READ_SCOPES,
  MCP_RESOURCE_SCOPES,
  MCP_WRITE_SCOPES,
  getAuthIssuerUrl,
  getMcpOAuthJwksUrl,
  getMcpOrigin,
  getMcpProtectedResourceMetadataUrl,
  getMcpResourceUrl,
  getOAuthUserInfoUrl,
} from "@/modules/auth/lib/oauth-urls";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { type TMcpGrant, parseMcpGrantPermissions } from "./grant";

const QUERY_CREDENTIAL_PARAMS = new Set([
  "api_key",
  "apikey",
  "x-api-key",
  "access_token",
  "token",
  "authorization",
]);

/**
 * RFC 9068 §2.1 media type for a JWT access token. Better Auth stamps it into the JWS header from
 * 1.7 onwards; 1.6 emitted no `typ` at all.
 */
const JWT_ACCESS_TOKEN_TYPE = "at+jwt";

const oauthResourceClient = oauthProviderResourceClient(auth);

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
};

/**
 * `failureSource` tells an operator which step failed — `jwks_fetch` means this server could not load
 * its own signing keys, which is what `MCP_OAUTH_JWKS_URL` fixes. The raw message is never logged.
 */
const getMcpOAuthFailureDetails = (error: unknown, failureSource: "jwks_fetch" | "token_verification") => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const cause = error instanceof Error ? error.cause : undefined;
  const errorCode = getErrorCode(error) ?? getErrorCode(cause);

  return { errorCode, errorName, failureSource };
};

const hasDecodableProtectedHeader = (token: string): boolean => {
  try {
    decodeProtectedHeader(token);
    return true;
  } catch {
    return false;
  }
};

/**
 * Loads the key set before `verifyBearerToken` does, because that call hides every way the load fails:
 * an endpoint answering non-2xx becomes a bare `Error("Jwks failed: …")`, and an unreachable one (DNS,
 * refused connection, no hairpin to the public origin) has its `TypeError` swallowed into the same
 * `no token payload` 401 as a garbage token. `getJwks` is the library's own loader and URL-keyed cache,
 * so it surfaces the real error, and on success `verifyBearerToken` reads the set cached here instead
 * of fetching again. `createLocalJWKSet` rejects a 200 that is not a key set (a proxy's login page),
 * which the library would otherwise cache and trip over later as another swallowed `TypeError`.
 *
 * Skipped for a token whose header does not decode: `getJwks` would refuse it before fetching, and
 * `verifyBearerToken` rejects it anyway.
 */
async function loadMcpOAuthJwks(
  token: string,
  jwksUrl: string
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  if (!hasDecodableProtectedHeader(token)) {
    return { ok: true };
  }

  try {
    createLocalJWKSet(await getJwks(token, { jwksFetch: jwksUrl }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export type TMcpAuthInfo = AuthInfo & {
  extra: {
    formbricksAuthentication: TV3Authentication;
    requestId: string;
    authMethod: "apiKey" | "oauth";
    /**
     * Set on an OAuth token whose user holds only the Dashboard viewer role (ADR-0025). Such a token is
     * trimmed to `dashboards:read`, and the dashboard-bound chart read accepts it on that scope alone.
     */
    dashboardViewerOnly?: boolean;
    /**
     * The connection's grant (ADR-0041), read with the user on every OAuth request. Every tool call is
     * held to its permissions on top of the token's scopes, and every authorization decision to its
     * organization & workspace access (ADR-0042). Absent on the API-key path, which has no grant.
     */
    grant?: TMcpRequestGrant;
  };
};

/** A request's grant: what the tool guard reads, and its id, the subject `can()` checks it as. */
export type TMcpRequestGrant = TMcpGrant & { id: string };

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

/**
 * Scopes for the API-key path, derived from the key's workspace permissions: every read scope always,
 * and every write scope once the key holds `write` or `manage` on any workspace.
 *
 * Every family is granted, `responses:*` (ENG-2862) and `dashboards:*` (ENG-6581) included, because it
 * widens nothing: the scope only opens the tool, and the operation behind it still checks the key's
 * permission on the workspace it names — exactly what the same key gets over REST. The PII argument
 * that gives responses their own scope is about the **OAuth** path, where a user grants scopes at
 * consent and a token minted for surveys must not silently carry respondent answers — that is handled
 * by the scope being separately grantable, not by omitting it here.
 */
function getMcpScopes(authentication: TAuthenticationApiKey): string[] {
  const canWrite = authentication.workspacePermissions.some(
    (permission) => permission.permission === "write" || permission.permission === "manage"
  );

  return canWrite ? [...MCP_READ_SCOPES, ...MCP_WRITE_SCOPES] : [...MCP_READ_SCOPES];
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

/**
 * What every OAuth request needs to know about its user, in one read: whether the user is active, whether
 * every membership they hold is the Dashboard viewer role (`hasOnlyDashboardViewerRoles`), and the grant
 * the user gave this client (ADR-0041), `null` without one.
 */
async function getOAuthUserStanding(
  userId: string,
  clientId: string
): Promise<{ isActive: boolean; isDashboardViewerOnly: boolean; grant: TMcpRequestGrant | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      memberships: { select: { role: true } },
      mcpGrants: { where: { clientId }, select: { id: true, access: true, permissions: true } },
    },
  });
  const grant = user?.mcpGrants[0];

  return {
    isActive: user?.isActive === true,
    isDashboardViewerOnly: hasOnlyDashboardViewerRoles(user?.memberships ?? []),
    grant: grant
      ? { id: grant.id, access: grant.access, permissions: parseMcpGrantPermissions(grant.permissions) }
      : null,
  };
}

/**
 * The slice of the SDK's `ServerContext` our tools actually read. Derived from it rather than
 * hand-written, so it tracks the SDK, but narrow enough that a test can hand a handler
 * `{ http: { authInfo } }` instead of constructing a whole context.
 *
 * `http` is optional because it is absent on non-HTTP transports. Ours is HTTP-only, so in practice it
 * is always there — but the tools already handle a missing token, so nothing needs to assert it.
 */
/**
 * `mcpReq` joins `http` here for the multi-round-trip tools: a confirmation arrives as
 * `mcpReq.inputResponses` and its sealed state as `mcpReq.requestState()`, neither of which is
 * reachable through `http`. Still a `Pick` rather than the whole `ServerContext`, so a tool cannot
 * quietly start driving the server from inside a handler.
 */
export type TMcpToolContext = Pick<ServerContext, "http" | "mcpReq">;

/**
 * The single place that knows where the SDK puts verified auth on the handler context. Every tool goes
 * through this rather than reaching into `ctx.http?.authInfo` itself, so a future SDK or adapter change
 * to the context shape is one edit here instead of one per tool (the v1 -> v2 move was exactly that).
 */
export function getMcpToolAuthInfo(ctx: TMcpToolContext): AuthInfo | undefined {
  return ctx.http?.authInfo;
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

  // statusCode last: a caller's context must not be able to relabel the status this actually returns.
  log.warn({ ...logContext, statusCode: 401 }, logMessage);
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
  const jwksUrl = getMcpOAuthJwksUrl();

  const jwks = await loadMcpOAuthJwks(token, jwksUrl);
  if (!jwks.ok) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth authentication failed",
      logContext: getMcpOAuthFailureDetails(jwks.error, "jwks_fetch"),
    });
  }

  try {
    // Renamed from `verifyAccessToken` in Better Auth 1.7 (ENG-2343). `hasAcceptedMcpAudience` below is
    // kept regardless of what upstream does with `verifyOptions.audience`: an earlier version of this
    // comment asserted that 1.7 stops passing it into its own `jwtVerify`, which could not be
    // substantiated — `verifyBearerToken` is re-exported through `better-auth/oauth2` and its body is not
    // readable in the published dist. So the reason to keep our own check is not a claim about upstream:
    // it is that "every `aud` resolves to a registered resource" and "this token is for ME" are different
    // questions, and only the second is the one a resource server must answer. Ours answers it.
    payload = await oauthResourceClient.getActions().verifyBearerToken(token, {
      verifyOptions: {
        audience: getMcpResourceUrl(),
        issuer: getAuthIssuerUrl(),
        // RFC 9068 §4: an access token must be typed `at+jwt`, and a resource server should refuse
        // one that is not. Enforceable only from 1.7 — 1.6 issued no `typ` header at all, so
        // requiring it before the upgrade would have rejected every token in circulation.
        //
        // Kept strict through the rolling deploy, deliberately. A 1.6-minted token (no `typ`) hitting a
        // 1.7 pod is rejected here — but this check is on the RESOURCE SERVER only, not on the refresh
        // path, and `20260812110001_eng_2343_backfill_oauth_resource_links` backfills
        // `oauthRefreshToken.resources` precisely so existing refresh tokens keep working. So a client
        // takes one 401, refreshes against the 1.7 authorization server, and retries with a typed token:
        // self-healing in a single round trip, which is the 401 handling every MCP client already
        // implements. Relaxing this to "absent is fine" would weaken a cross-JWT-confusion defence
        // permanently to smooth a window that closes on its own — the wrong trade in the PR whose whole
        // purpose is binding token audiences.
        typ: JWT_ACCESS_TOKEN_TYPE,
      },
      jwksUrl,
    });
  } catch (error) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth authentication failed",
      logContext: getMcpOAuthFailureDetails(error, "token_verification"),
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
  const standing = await getOAuthUserStanding(sessionAuthentication.user.id, authInfo.clientId);
  if (!standing.isActive) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth token user is inactive",
      logContext: { clientId: authInfo.clientId },
    });
  }

  // ADR-0041: the grant is the connection's liveness check. Revoke deletes it with the consent, so a token
  // minted before the revoke is refused here on its next call rather than living out its 15 minutes. A
  // 401 like any dead token: the client refreshes, the refresh is refused for the same reason
  // (`requireOAuthConsentOnRefreshAfterHandler`), and it goes back through the consent screen.
  if (!standing.grant) {
    return await rejectUnauthenticatedMcpRequest({
      requestId,
      instance,
      log,
      logMessage: "MCP OAuth connection has no grant",
      logContext: { clientId: authInfo.clientId },
    });
  }

  // Its organization & workspace access is enforced by `can()` for the whole request
  // (`handleAuthenticatedMcpRequest`, ADR-0042).
  authInfo.extra.grant = standing.grant;

  // ADR-0025: a Dashboard viewer's grant never reaches past `dashboards:read`, whatever the token
  // carries. Consent already narrows new grants; this bounds a token minted before the user became a
  // viewer, for the up-to-15 minutes it stays valid, and any grant a revocation missed. Trimming applies
  // to a user who is a viewer in every organization they belong to. A user who is a viewer in one
  // organization and holds another role elsewhere keeps their scopes: each operation still asks SpiceDB,
  // which refuses them everything but dashboard reads in the viewer organization.
  if (standing.isDashboardViewerOnly) {
    authInfo.scopes = trimScopesForDashboardViewer(authInfo.scopes);
    authInfo.extra.dashboardViewerOnly = true;
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

/** True for an OAuth token whose user holds only the Dashboard viewer role (set at authentication). */
export function isMcpDashboardViewerOnly(authInfo: AuthInfo | undefined): boolean {
  return authInfo?.extra?.dashboardViewerOnly === true;
}

/** True when the caller holds at least one of `allowedScopes` (any-of, unlike `hasMcpScopes`). */
export function hasAnyMcpScope(authInfo: AuthInfo | undefined, allowedScopes: readonly string[]): boolean {
  const scopes = authInfo?.scopes ?? [];
  return allowedScopes.some((scope) => scopes.includes(scope));
}

/**
 * The refusal for a tool whose permissions the token's scopes don't reach: the scopes cap the grant
 * (ADR-0041), so this is the grant-style "Not permitted", naming the permissions (`needs`), and saying the
 * client must be reconnected, since only a new consent gives the token more scopes. The scopes the token
 * lacks are named in `detail` too, not only in the `WWW-Authenticate` challenge, because the tool path
 * cannot carry a header: the guard hands this Response to `responseToMcpToolResult`, which serializes the
 * JSON body into a JSON-RPC result and drops every header. The challenge (every scope the tool needs) is
 * still set for the transport-level 403, where the header does reach clients.
 */
export function createMcpScopeNotPermittedResponse(
  requestId: string,
  {
    needs,
    missingScopes,
    challengeScopes,
    anyOf = false,
  }: { needs: string; missingScopes: string[]; challengeScopes: string[]; anyOf?: boolean }
): Response {
  const scopes = missingScopes.join(" ");
  let lacks = `lacks the scope ${scopes}`;
  if (anyOf) lacks = `lacks every one of the scopes ${scopes}`;
  else if (missingScopes.length > 1) lacks = `lacks the scopes ${scopes}`;
  return withInsufficientScopeChallenge(
    problemForbidden(
      requestId,
      `Not permitted: the user's grant to this MCP client can't include ${needs}, because its OAuth token ${lacks}. Ask the user to reconnect the client and give it this access.`,
      "/api/mcp"
    ),
    challengeScopes
  );
}

/**
 * The refusal for a tool the grant does not cover (ADR-0041). Unlike an insufficient scope, it carries no
 * `WWW-Authenticate` challenge: re-authorizing for more scopes would not help, the user has to change the
 * grant. `detail` names what the grant would have to give, so an agent can tell the user what to change.
 * The `code` stays `forbidden`, from the published vocabulary; `detail` starting "Not permitted" is what
 * tells it apart from a refusal by the user's own role.
 */
export function createMcpNotPermittedResponse(requestId: string, needs: string): Response {
  return problemForbidden(
    requestId,
    `Not permitted: the user's grant to this MCP client does not give ${needs}. Ask the user to give the client this access.`,
    "/api/mcp"
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

/**
 * What `can()` holds the request to (ADR-0042): the grant, when it limits organization & workspace
 * access. All access needs no second check, and an API key has no grant.
 */
const getAuthorizationMcpGrant = (authInfo: TMcpAuthInfo): TAuthorizationMcpGrant | undefined => {
  const { grant, formbricksAuthentication } = authInfo.extra;
  if (!grant || grant.access === "all") return undefined;
  const userId =
    formbricksAuthentication && "user" in formbricksAuthentication
      ? formbricksAuthentication.user?.id
      : undefined;
  if (!userId) throw new Error("An MCP grant must belong to a signed-in user");
  return { id: grant.id, userId };
};

export async function handleAuthenticatedMcpRequest(
  request: NextRequest,
  handler: (request: Request) => Promise<Response>
): Promise<Response> {
  const authResult = await authenticateMcpRequest(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  (request as Request & { auth?: AuthInfo }).auth = authResult.authInfo;
  const response = await withAuthorizationSurface("mcp", () => handler(request), {
    mcpGrant: getAuthorizationMcpGrant(authResult.authInfo),
  });
  return withMcpResponseHeaders(response, authResult.requestId);
}
