import "server-only";
import { NextRequest } from "next/server";
import { TGatewayOriginalRequest, buildGatewayStatusResponse } from "@/modules/gateway-auth/lib/request";

const TRAEFIK_AUTH_PREFIX = "/api/traefik-auth";

const isTraefikAuthPath = (pathname: string): boolean =>
  pathname === TRAEFIK_AUTH_PREFIX || pathname.startsWith(`${TRAEFIK_AUTH_PREFIX}/`);

const buildForwardedRequestUrl = (request: NextRequest, forwardedUri: string): URL => {
  if (forwardedUri.startsWith("http://") || forwardedUri.startsWith("https://")) {
    return new URL(forwardedUri);
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "traefik-auth.local";
  const normalizedUri = forwardedUri.startsWith("/") ? forwardedUri : `/${forwardedUri}`;

  return new URL(normalizedUri, `${proto}://${host}`);
};

export const buildTraefikAllowResponse = (): Response => new Response(null, { status: 200 });

export const parseTraefikRequestMetadata = (
  request: NextRequest
): { originalRequest: TGatewayOriginalRequest } | { errorResponse: Response } => {
  if (!isTraefikAuthPath(request.nextUrl.pathname)) {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Invalid Traefik auth request path"),
    };
  }

  const forwardedMethod = request.headers.get("x-forwarded-method")?.trim();
  const forwardedUri = request.headers.get("x-forwarded-uri")?.trim();

  if (!forwardedMethod || !forwardedUri) {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Missing original request metadata"),
    };
  }

  try {
    return {
      originalRequest: {
        method: forwardedMethod.toUpperCase(),
        url: buildForwardedRequestUrl(request, forwardedUri),
      },
    };
  } catch {
    return {
      errorResponse: buildGatewayStatusResponse(400, "Invalid original request URI"),
    };
  }
};
