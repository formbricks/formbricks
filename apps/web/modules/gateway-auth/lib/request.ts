import "server-only";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
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
      try {
        const { userId } = gatewayToken.verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isActive: true },
        });

        if (!user || user.isActive === false) {
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
      } catch {
        return { status: "invalid" };
      }
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

  const authenticationResult = await authenticateGatewayRequest(request, authorizer.gatewayToken);
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
