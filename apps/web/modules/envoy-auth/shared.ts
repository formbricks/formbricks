import "server-only";
import { NextRequest } from "next/server";
import { TGatewayOriginalRequest, buildGatewayStatusResponse } from "@/modules/gateway-auth/lib/request";

const ENVOY_AUTH_PREFIX = "/api/envoy-auth";
const HEADERS_TO_REMOVE_ON_ALLOW = "x-api-key,authorization,cookie";

export const buildEnvoyAllowResponse = (): Response =>
  new Response(null, {
    status: 200,
    headers: {
      "x-envoy-auth-headers-to-remove": HEADERS_TO_REMOVE_ON_ALLOW,
    },
  });

export const parseEnvoyRequestMetadata = (
  request: NextRequest
): { originalRequest: TGatewayOriginalRequest } | { errorResponse: Response } => {
  if (!request.nextUrl.pathname.startsWith(`${ENVOY_AUTH_PREFIX}/`)) {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Invalid Envoy auth request path"),
    };
  }

  const originalPathSegments = request.nextUrl.pathname
    .slice(ENVOY_AUTH_PREFIX.length)
    .split("/")
    .filter(Boolean);

  if (originalPathSegments.length === 0) {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Missing original request path"),
    };
  }

  try {
    const originalPathname = originalPathSegments.length > 0 ? `/${originalPathSegments.join("/")}` : "/";
    const originalPath = `${originalPathname}${request.nextUrl.search}`;

    return {
      originalRequest: {
        method: request.method.toUpperCase(),
        url: new URL(originalPath, "https://envoy-auth.local"),
      },
    };
  } catch {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Invalid original request path"),
    };
  }
};
