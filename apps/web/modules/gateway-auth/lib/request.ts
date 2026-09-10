import "server-only";
import { NextRequest } from "next/server";
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
    };

export type TGatewayAuthenticationResult =
  | { status: "authenticated"; principal: TGatewayAuthenticatedPrincipal }
  | { status: "invalid" }
  | { status: "missing" };

export type TGatewayAuthorizationDecision = { status: "allow" } | { status: "deny"; response: Response };

export type TGatewayRequestAuthorizer = {
  matches: (originalRequest: TGatewayOriginalRequest) => boolean;
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
  request: NextRequest
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

  const proxySession = await getProxySession(request);
  if (!proxySession) {
    return { status: "missing" };
  }

  return {
    status: "authenticated",
    principal: {
      type: "user",
      userId: proxySession.userId,
    },
  };
};

export const authorizeGatewayRequest = async ({
  request,
  originalRequest,
  authorizers,
  requestId,
  buildAllowResponse,
  unsupportedRouteMessage,
}: {
  request: NextRequest;
  originalRequest: TGatewayOriginalRequest;
  authorizers: TGatewayRequestAuthorizer[];
  requestId: string;
  buildAllowResponse: () => Response;
  unsupportedRouteMessage: string;
}): Promise<Response> => {
  const authorizer = authorizers.find((candidate) => candidate.matches(originalRequest));
  if (!authorizer) {
    return buildGatewayStatusResponse(400, unsupportedRouteMessage);
  }

  const authenticationResult = await authenticateGatewayRequest(request);
  if (authenticationResult.status === "missing" || authenticationResult.status === "invalid") {
    return buildGatewayStatusResponse(401, "Unauthorized");
  }

  const authorizationDecision = await authorizer.authorize({
    request,
    originalRequest,
    principal: authenticationResult.principal,
    requestId,
  });

  return authorizationDecision.status === "allow" ? buildAllowResponse() : authorizationDecision.response;
};
