import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemTooManyRequests,
  problemUnauthorized,
} from "@/app/api/v3/lib/response";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { authenticateApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const QUERY_CREDENTIAL_PARAMS = new Set([
  "api_key",
  "apikey",
  "x-api-key",
  "access_token",
  "token",
  "authorization",
]);

export type TMcpAuthInfo = AuthInfo & {
  extra: {
    formbricksAuthentication: TAuthenticationApiKey;
    requestId: string;
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
  return new URL(getPublicDomain()).origin;
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
  const scopes = new Set(["surveys:read", "workflows:read"]);
  if (
    authentication.workspacePermissions.some(
      (permission) => permission.permission === "write" || permission.permission === "manage"
    )
  ) {
    scopes.add("surveys:write");
  }

  return Array.from(scopes);
}

function createMcpAuthInfo(authentication: TAuthenticationApiKey, requestId: string): TMcpAuthInfo {
  return {
    token: authentication.apiKeyId,
    clientId: authentication.apiKeyId,
    scopes: getMcpScopes(authentication),
    extra: {
      formbricksAuthentication: authentication,
      requestId,
    },
  };
}

export function getMcpAuthentication(authInfo?: AuthInfo): TAuthenticationApiKey | null {
  const authentication = authInfo?.extra?.formbricksAuthentication;
  if (!authentication || typeof authentication !== "object" || !("apiKeyId" in authentication)) {
    return null;
  }

  return authentication as TAuthenticationApiKey;
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
    const authentication = await authenticateApiKeyFromHeaders(request.headers);
    if (!authentication) {
      log.warn({ statusCode: 401 }, "MCP API authentication failed");
      return {
        ok: false,
        requestId,
        response: problemUnauthorized(requestId, "API key required", instance),
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
      authInfo: createMcpAuthInfo(authentication, requestId),
    };
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
