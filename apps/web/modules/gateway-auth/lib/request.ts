import "server-only";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { authenticateApiKeyFromHeaders, getApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { getProxySession } from "@/modules/auth/lib/proxy-session";

export type TGatewayOriginalRequest = {
  method: string;
  url: URL;
};

export type TGatewayAuthenticatedPrincipal =
  | {
      type: "apiKey";
      authentication: TAuthenticationApiKey;
    }
  | {
      type: "user";
      userId: string;
      source: "session" | "jwt";
    };

export type TGatewayTokenHandler = {
  getTokenFromHeaders: (headers: Headers) => string | null;
  verifyToken: (token: string) => { userId: string };
};

export type TGatewayAuthenticationResult =
  | { status: "authenticated"; principal: TGatewayAuthenticatedPrincipal }
  | { status: "invalid" }
  | { status: "missing" };

export type TGatewayAuthorizationDecision = { status: "allow" } | { status: "deny"; response: Response };

export type TGatewayRequestAuthorizer = {
  matches: (originalRequest: TGatewayOriginalRequest) => boolean;
  gatewayToken?: TGatewayTokenHandler;
  authorize: (params: {
    request: NextRequest;
    originalRequest: TGatewayOriginalRequest;
    principal: TGatewayAuthenticatedPrincipal;
    requestId: string;
  }) => Promise<TGatewayAuthorizationDecision>;
};

export const buildGatewayStatusResponse = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });

export const allowGatewayRequest = (): TGatewayAuthorizationDecision => ({ status: "allow" });

export const authenticateGatewayRequest = async (
  request: NextRequest,
  gatewayToken?: TGatewayTokenHandler
): Promise<TGatewayAuthenticationResult> => {
  if (getApiKeyFromHeaders(request.headers)) {
    const apiKeyAuthentication = await authenticateApiKeyFromHeaders(request.headers);
    if (!apiKeyAuthentication) {
      logger.warn({ hasApiKey: true, reason: "invalid_api_key" }, "Gateway authentication failed");
      return { status: "invalid" };
    }

    return {
      status: "authenticated",
      principal: {
        type: "apiKey",
        authentication: apiKeyAuthentication,
      },
    };
  }

  if (gatewayToken) {
    const token = gatewayToken.getTokenFromHeaders(request.headers);
    if (token) {
      let userId: string;

      try {
        ({ userId } = gatewayToken.verifyToken(token));
      } catch (error) {
        logger.warn(
          { error, hasToken: true, reason: "token_verification_failed" },
          "Gateway authentication failed"
        );
        return { status: "invalid" };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!user || user.isActive === false) {
        logger.warn(
          {
            hasToken: true,
            reason: "user_missing_or_inactive",
            userId,
            userFound: Boolean(user),
            isActive: user?.isActive ?? null,
          },
          "Gateway authentication failed"
        );
        return { status: "invalid" };
      }

      return {
        status: "authenticated",
        principal: {
          type: "user",
          userId: user.id,
          source: "jwt",
        },
      };
    }
  }

  const proxySession = await getProxySession(request);
  if (!proxySession) {
    return { status: "missing" };
  }

  return {
    status: "authenticated",
    principal: {
      type: "user",
      userId: proxySession.userId,
      source: "session",
    },
  };
};

/**
 * The outcome of authorizing a request, rather than a response meaning "allowed".
 *
 * This used to answer a bare `Response` — a 200 with an empty body — because Envoy's ext_authz reads
 * an allow that way, and the caller supplied the body to send. That gateway is gone (ENG-3117) and
 * the single remaining caller forwards the request itself, so it needs the principal it was allowed
 * as: without it there is nothing to rate-limit against but the credential, which would mean
 * authenticating twice.
 */
export type TGatewayAuthorizationOutcome =
  | { status: "allow"; principal: TGatewayAuthenticatedPrincipal }
  | { status: "deny"; response: Response };

export const authorizeGatewayRequest = async ({
  request,
  originalRequest,
  authorizers,
  requestId,
  unsupportedRouteMessage,
}: {
  request: NextRequest;
  originalRequest: TGatewayOriginalRequest;
  authorizers: TGatewayRequestAuthorizer[];
  requestId: string;
  unsupportedRouteMessage: string;
}): Promise<TGatewayAuthorizationOutcome> => {
  const authorizer = authorizers.find((candidate) => candidate.matches(originalRequest));
  if (!authorizer) {
    return { status: "deny", response: buildGatewayStatusResponse(400, unsupportedRouteMessage) };
  }

  const authenticationResult = await authenticateGatewayRequest(request, authorizer.gatewayToken);
  if (authenticationResult.status === "missing" || authenticationResult.status === "invalid") {
    return { status: "deny", response: buildGatewayStatusResponse(401, "Unauthorized") };
  }

  const authorizationDecision = await authorizer.authorize({
    request,
    originalRequest,
    principal: authenticationResult.principal,
    requestId,
  });

  return authorizationDecision.status === "allow"
    ? { status: "allow", principal: authenticationResult.principal }
    : { status: "deny", response: authorizationDecision.response };
};

/**
 * What the rate limit is counted against — the same choice the v3 wrapper makes: the API key, or the
 * user behind a session.
 */
export const getGatewayRateLimitIdentifier = (principal: TGatewayAuthenticatedPrincipal): string =>
  principal.type === "apiKey" ? principal.authentication.apiKeyId : principal.userId;
