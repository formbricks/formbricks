import "server-only";
import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  authenticateApiKeyFromHeaders,
  getApiKeyFromHeaders,
} from "@/modules/api/lib/api-key-auth";
import { getProxySession } from "@/modules/auth/lib/proxy-session";

export const ENVOY_AUTH_PREFIX = "/api/envoy-auth";
export const HEADERS_TO_REMOVE_ON_ALLOW = "x-api-key,authorization,cookie";

export type TEnvoyOriginalRequest = {
  method: string;
  url: URL;
};

export type TEnvoyAuthenticatedPrincipal =
  | {
      type: "apiKey";
      authentication: TAuthenticationApiKey;
    }
  | {
      type: "user";
      userId: string;
      source: "session" | "jwt";
    };

export type TEnvoyGatewayTokenHandler = {
  getTokenFromHeaders: (headers: Headers) => string | null;
  verifyToken: (token: string) => { userId: string };
};

export type TEnvoyAuthenticationResult =
  | { status: "authenticated"; principal: TEnvoyAuthenticatedPrincipal }
  | { status: "invalid" }
  | { status: "missing" };

export type TEnvoyRequestAuthorizer = {
  matches: (originalRequest: TEnvoyOriginalRequest) => boolean;
  gatewayToken?: TEnvoyGatewayTokenHandler;
  authorize: (params: {
    request: NextRequest;
    originalRequest: TEnvoyOriginalRequest;
    principal: TEnvoyAuthenticatedPrincipal;
    requestId: string;
  }) => Promise<Response>;
};

export const buildAllowResponse = (): Response =>
  new Response(null, {
    status: 200,
    headers: {
      "x-envoy-auth-headers-to-remove": HEADERS_TO_REMOVE_ON_ALLOW,
    },
  });

export const buildStatusResponse = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });

export const parseEnvoyRequestMetadata = (
  request: NextRequest
):
  | { originalRequest: TEnvoyOriginalRequest }
  | { errorResponse: Response } => {
  if (!request.nextUrl.pathname.startsWith(`${ENVOY_AUTH_PREFIX}/`)) {
    return {
      errorResponse: buildStatusResponse(400, "Invalid Envoy auth request path"),
    };
  }

  const originalPathSegments = request.nextUrl.pathname
    .slice(ENVOY_AUTH_PREFIX.length)
    .split("/")
    .filter(Boolean);

  if (originalPathSegments.length === 0) {
    return {
      errorResponse: buildStatusResponse(400, "Missing original request path"),
    };
  }

  try {
    const originalPathname =
      originalPathSegments.length > 0 ? `/${originalPathSegments.join("/")}` : "/";
    const originalPath = `${originalPathname}${request.nextUrl.search}`;

    return {
      originalRequest: {
        method: request.method.toUpperCase(),
        url: new URL(originalPath, "https://envoy-auth.local"),
      },
    };
  } catch {
    return {
      errorResponse: buildStatusResponse(400, "Invalid original request path"),
    };
  }
};

export const authenticateEnvoyRequest = async (
  request: NextRequest,
  gatewayToken?: TEnvoyGatewayTokenHandler
): Promise<TEnvoyAuthenticationResult> => {
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
