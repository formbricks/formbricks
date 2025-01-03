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
  isShareUrlRoute,
  isSignupRoute,
  isSyncWithUserIdentificationEndpoint,
  isVerifyEmailRoute,
} from "@/app/middleware/endpoint-validator";
import { ipAddress } from "@vercel/functions";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RATE_LIMITING_DISABLED, WEBAPP_URL } from "@formbricks/lib/constants";
import { isValidCallbackUrl } from "@formbricks/lib/utils/url";

export const middleware = async (request: NextRequest) => {
  // issue with next auth types; let's review when new fixes are available
  const token = await getToken({ req: request as any });

  if (isAuthProtectedRoute(request.nextUrl.pathname) && !token) {
    const loginUrl = `${WEBAPP_URL}/auth/login?callbackUrl=${encodeURIComponent(WEBAPP_URL + request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  if (callbackUrl && !isValidCallbackUrl(callbackUrl, WEBAPP_URL)) {
    return NextResponse.json({ error: "Invalid callback URL" });
  }
  if (token && callbackUrl) {
    return NextResponse.redirect(WEBAPP_URL + callbackUrl);
  }
  if (process.env.NODE_ENV !== "production" || RATE_LIMITING_DISABLED) {
    return NextResponse.next();
  }

  let ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    ipAddress(request);

  if (ip) {
    try {
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
      return NextResponse.next();
    } catch (e) {
      console.log(`Rate Limiting IP: ${ip}`);
      return NextResponse.json({ error: "Too many requests, Please try after a while!" }, { status: 429 });
    }
  }
  return NextResponse.next();
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
  ],
};
