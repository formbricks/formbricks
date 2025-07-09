import { clientSideApiEndpointsLimiter, syncUserIdentificationLimiter } from "@/app/middleware/bucket";
import { isPublicDomainConfigured, isRequestFromPublicDomain } from "@/app/middleware/domain-utils";
import {
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isRouteAllowedForDomain,
  isSyncWithUserIdentificationEndpoint,
} from "@/app/middleware/endpoint-validator";
import { IS_PRODUCTION, RATE_LIMITING_DISABLED, WEBAPP_URL } from "@/lib/constants";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { isValidCallbackUrl } from "@/lib/utils/url";
import { logApiErrorEdge } from "@/modules/api/v2/lib/utils-edge";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";

const handleAuth = async (request: NextRequest): Promise<Response | null> => {
  const token = await getToken({ req: request as any });

  if (isAuthProtectedRoute(request.nextUrl.pathname) && !token) {
    const loginUrl = `${WEBAPP_URL}/auth/login?callbackUrl=${encodeURIComponent(WEBAPP_URL + request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");

  if (callbackUrl && !isValidCallbackUrl(callbackUrl, WEBAPP_URL)) {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  if (token && callbackUrl) {
    return NextResponse.redirect(callbackUrl);
  }

  return null;
};

const applyRateLimiting = async (request: NextRequest, ip: string) => {
  if (isClientSideApiRoute(request.nextUrl.pathname)) {
    await clientSideApiEndpointsLimiter(`client-side-api-${ip}`);
    const envIdAndUserId = isSyncWithUserIdentificationEndpoint(request.nextUrl.pathname);
    if (envIdAndUserId) {
      const { environmentId, userId } = envIdAndUserId;
      await syncUserIdentificationLimiter(`sync-${environmentId}-${userId}`);
    }
  }
};

/**
 * Handle domain-aware routing based on PUBLIC_URL and WEBAPP_URL
 */
const handleDomainAwareRouting = (request: NextRequest): Response | null => {
  try {
    const publicDomainConfigured = isPublicDomainConfigured();

    // When PUBLIC_URL is not configured, admin domain allows all routes (backward compatibility)
    if (!publicDomainConfigured) return null;

    const isPublicDomain = isRequestFromPublicDomain(request);

    const pathname = request.nextUrl.pathname;

    // Check if the route is allowed for the current domain
    const isAllowed = isRouteAllowedForDomain(pathname, isPublicDomain);

    if (!isAllowed) {
      return new NextResponse(null, { status: 404 });
    }

    return null; // Allow the request to continue
  } catch (error) {
    logger.error(error, "Error handling domain-aware routing");
    return new NextResponse(null, { status: 404 });
  }
};

export const middleware = async (originalRequest: NextRequest) => {
  // Handle domain-aware routing first
  const domainResponse = handleDomainAwareRouting(originalRequest);
  if (domainResponse) return domainResponse;

  // Create a new Request object to override headers and add a unique request ID header
  const request = new NextRequest(originalRequest, {
    headers: new Headers(originalRequest.headers),
  });

  request.headers.set("x-request-id", uuidv4());
  request.headers.set("x-start-time", Date.now().toString());

  // Create a new NextResponse object to forward the new request with headers
  const nextResponseWithCustomHeader = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Handle authentication
  const authResponse = await handleAuth(request);
  if (authResponse) return authResponse;

  const ip = await getClientIpFromHeaders();

  if (!IS_PRODUCTION || RATE_LIMITING_DISABLED) {
    return nextResponseWithCustomHeader;
  }

  if (ip) {
    try {
      await applyRateLimiting(request, ip);
      return nextResponseWithCustomHeader;
    } catch (e) {
      logger.error(e, "Error applying rate limiting");
      const apiError: ApiErrorResponseV2 = {
        type: "too_many_requests",
        details: [{ field: "", issue: "Too many requests. Please try again later." }],
      };
      logApiErrorEdge(request, apiError);
      return NextResponse.json(apiError, { status: 429 });
    }
  }

  return nextResponseWithCustomHeader;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|js|css|images|fonts|icons|public).*)",
  ],
};
