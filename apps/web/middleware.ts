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
import { E2E_TESTING, IS_PRODUCTION, RATE_LIMITING_DISABLED, SURVEY_URL, WEBAPP_URL } from "@/lib/constants";
import { isValidCallbackUrl } from "@/lib/utils/url";
import { logApiError } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ipAddress } from "@vercel/functions";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";

const enforceHttps = (request: NextRequest): Response | null => {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";
  if (IS_PRODUCTION && !E2E_TESTING && forwardedProto !== "https") {
    const apiError: ApiErrorResponseV2 = {
      type: "forbidden",
      details: [
        {
          field: "",
          issue: "Only HTTPS connections are allowed on the management endpoints.",
        },
      ],
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
    return NextResponse.redirect(callbackUrl);
  }

  return null;
};

const applyRateLimiting = async (request: NextRequest, ip: string) => {
  if (isLoginRoute(request.nextUrl.pathname)) {
    await loginLimiter(`login-${ip}`);
  } else if (isSignupRoute(request.nextUrl.pathname)) {
    await signupLimiter(`signup-${ip}`);
  } else if (isVerifyEmailRoute(request.nextUrl.pathname)) {
    await verifyEmailLimiter(`verify-email-${ip}`);
  } else if (isForgotPasswordRoute(request.nextUrl.pathname)) {
    await forgotPasswordLimiter(`forgot-password-${ip}`);
  } else if (isClientSideApiRoute(request.nextUrl.pathname)) {
    await clientSideApiEndpointsLimiter(`client-side-api-${ip}`);
    const envIdAndUserId = isSyncWithUserIdentificationEndpoint(request.nextUrl.pathname);
    if (envIdAndUserId) {
      const { environmentId, userId } = envIdAndUserId;
      await syncUserIdentificationLimiter(`sync-${environmentId}-${userId}`);
    }
  } else if (isShareUrlRoute(request.nextUrl.pathname)) {
    await shareUrlLimiter(`share-${ip}`);
  }
};

const handleSurveyDomain = (request: NextRequest): Response | null => {
  try {
    if (!SURVEY_URL) return null;

    const host = request.headers.get("host") || "";
    const surveyDomain = SURVEY_URL ? new URL(SURVEY_URL).host : "";
    if (host !== surveyDomain) return null;

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    logger.error(error, "Error handling survey domain");
    return new NextResponse(null, { status: 404 });
  }
};

const isSurveyRoute = (request: NextRequest) => {
  return request.nextUrl.pathname.startsWith("/c/") || request.nextUrl.pathname.startsWith("/s/");
};

export const middleware = async (originalRequest: NextRequest) => {
  if (isSurveyRoute(originalRequest)) {
    return NextResponse.next();
  }

  // Handle survey domain routing.
  const surveyResponse = handleSurveyDomain(originalRequest);
  if (surveyResponse) return surveyResponse;

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

  // Enforce HTTPS for management endpoints
  if (isManagementApiRoute(request.nextUrl.pathname)) {
    const httpsResponse = enforceHttps(request);
    if (httpsResponse) return httpsResponse;
  }

  // Handle authentication
  const authResponse = await handleAuth(request);
  if (authResponse) return authResponse;

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
      return NextResponse.json(apiError, { status: 429 });
    }
  }

  return nextResponseWithCustomHeader;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|js|css|images|fonts|icons|public|api/v1/og).*)", // Exclude the Open Graph image generation route from middleware
  ],
};
