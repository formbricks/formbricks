import {
  clientSideApiEndpointsLimiter,
  forgotPasswordLimiter,
  loginLimiter,
  shareUrlLimiter,
  signupLimiter,
  syncUserIdentificationLimiter,
  verifyEmailLimiter,
} from "@/app/middleware/bucket";
import {
  isAuthProtectedRoute,
  isClientSideApiRoute,
  isForgotPasswordRoute,
  isLoginRoute,
  isManagementApiRoute,
  isShareUrlRoute,
  isSignupRoute,
  isSyncWithUserIdentificationEndpoint,
  isVerifyEmailRoute,
} from "@/app/middleware/endpoint-validator";
import { logApiError } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ipAddress } from "@vercel/functions";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { E2E_TESTING, IS_PRODUCTION, RATE_LIMITING_DISABLED, WEBAPP_URL } from "@formbricks/lib/constants";
import { isValidCallbackUrl } from "@formbricks/lib/utils/url";

// Function to track metrics
const trackMetrics = (request: NextRequest, response: NextResponse | Response, startTime: number) => {
  if (typeof global === "undefined" || !(global as any).__FORMBRICKS_METRICS) {
    return;
  }

  const metrics = (global as any).__FORMBRICKS_METRICS;
  const duration = (Date.now() - startTime) / 1000; // Convert to seconds
  const status = response instanceof NextResponse ? response.status : 200;
  const labels = {
    method: request.method,
    path: request.nextUrl.pathname,
    status: status.toString(),
  };

  // Record request count
  if (metrics.requestCounter) {
    metrics.requestCounter.add(1, labels);
  }

  // Record request duration
  if (metrics.requestDuration) {
    metrics.requestDuration.record(duration, labels);
  }

  // If it's a survey response, track that too
  if (
    request.nextUrl.pathname.includes("/api/v1/client/") &&
    request.nextUrl.pathname.includes("/responses") &&
    request.method === "POST" &&
    metrics.surveyResponseCounter
  ) {
    metrics.surveyResponseCounter.add(1, {
      path: request.nextUrl.pathname,
    });
  }
};

const enforceHttps = (request: NextRequest): Response | null => {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";
  if (IS_PRODUCTION && !E2E_TESTING && forwardedProto !== "https") {
    const apiError: ApiErrorResponseV2 = {
      type: "forbidden",
      details: [{ field: "", issue: "Only HTTPS connections are allowed on the management endpoint." }],
    };
    logApiError(request, apiError);
    return NextResponse.json(apiError, { status: 403 });
  }
  return null;
};

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
    return NextResponse.redirect(WEBAPP_URL + callbackUrl);
  }
  return null;
};

const applyRateLimiting = (request: NextRequest, ip: string) => {
  if (isLoginRoute(request.nextUrl.pathname)) {
    loginLimiter(`login-${ip}`);
  } else if (isSignupRoute(request.nextUrl.pathname)) {
    signupLimiter(`signup-${ip}`);
  } else if (isVerifyEmailRoute(request.nextUrl.pathname)) {
    verifyEmailLimiter(`verify-email-${ip}`);
  } else if (isForgotPasswordRoute(request.nextUrl.pathname)) {
    forgotPasswordLimiter(`forgot-password-${ip}`);
  } else if (isClientSideApiRoute(request.nextUrl.pathname)) {
    clientSideApiEndpointsLimiter(`client-side-api-${ip}`);
    const envIdAndUserId = isSyncWithUserIdentificationEndpoint(request.nextUrl.pathname);
    if (envIdAndUserId) {
      const { environmentId, userId } = envIdAndUserId;
      syncUserIdentificationLimiter(`sync-${environmentId}-${userId}`);
    }
  } else if (isShareUrlRoute(request.nextUrl.pathname)) {
    shareUrlLimiter(`share-${ip}`);
  }
};

export const middleware = async (originalRequest: NextRequest) => {
  const startTime = Date.now();

  // Create a new Request object to override headers and add a unique request ID header
  const request = new NextRequest(originalRequest, {
    headers: new Headers(originalRequest.headers),
  });

  request.headers.set("x-request-id", uuidv4());

  // Create a new NextResponse object to forward the new request with headers
  const nextResponseWithCustomHeader = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Skip metrics for the metrics endpoint itself to avoid circular reporting
  if (request.nextUrl.pathname !== "/metrics") {
    // Track metrics for this request
    trackMetrics(request, nextResponseWithCustomHeader, startTime);
  }

  // Enforce HTTPS for management endpoints
  if (isManagementApiRoute(request.nextUrl.pathname)) {
    const httpsResponse = enforceHttps(request);
    if (httpsResponse) {
      trackMetrics(request, httpsResponse, startTime);
      return httpsResponse;
    }
  }

  // Handle authentication
  const authResponse = await handleAuth(request);
  if (authResponse) {
    trackMetrics(request, authResponse, startTime);
    return authResponse;
  }

  if (!IS_PRODUCTION || RATE_LIMITING_DISABLED) {
    return nextResponseWithCustomHeader;
  }

  let ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    ipAddress(request);

  if (ip) {
    try {
      applyRateLimiting(request, ip);
      return nextResponseWithCustomHeader;
    } catch (e) {
      const apiError: ApiErrorResponseV2 = {
        type: "too_many_requests",
        details: [{ field: "", issue: "Too many requests. Please try again later." }],
      };
      logApiError(request, apiError);
      const errorResponse = NextResponse.json(apiError, { status: 429 });
      trackMetrics(request, errorResponse, startTime);
      return errorResponse;
    }
  }

  return nextResponseWithCustomHeader;
};

export const config = {
  matcher: [
    "/api/auth/callback/credentials",
    "/api/(.*)/client/:path*",
    "/api/v1/js/actions",
    "/api/v1/client/storage",
    "/share/(.*)/:path",
    "/environments/:path*",
    "/setup/organization/:path*",
    "/api/auth/signout",
    "/auth/login",
    "/auth/signup",
    "/api/packages/:path*",
    "/auth/verification-requested",
    "/auth/forgot-password",
    "/api/v1/management/:path*",
    "/api/v2/management/:path*",
  ],
};
