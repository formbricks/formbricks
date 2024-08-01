import {
  clientSideApiEndpointsLimiter,
  loginLimiter,
  shareUrlLimiter,
  signUpLimiter,
  syncUserIdentificationLimiter,
} from "@/app/middleware/bucket";
import {
  clientSideApiRoute,
  isAuthProtectedRoute,
  isSyncWithUserIdentificationEndpoint,
  loginRoute,
  shareUrlRoute,
  signupRoute,
} from "@/app/middleware/endpointValidator";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RATE_LIMITING_DISABLED, WEBAPP_URL } from "@formbricks/lib/constants";

export const middleware = async (request: NextRequest) => {
  // issue with next auth types & Next 15; let's review when new fixes are available
  const token = await getToken({ req: request });

  if (isAuthProtectedRoute(request.nextUrl.pathname) && !token) {
    const loginUrl = `${WEBAPP_URL}/auth/login?callbackUrl=${encodeURIComponent(WEBAPP_URL + request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  if (token && callbackUrl) {
    return NextResponse.redirect(WEBAPP_URL + callbackUrl);
  }
  if (process.env.NODE_ENV !== "production" || RATE_LIMITING_DISABLED) {
    return NextResponse.next();
  }

  let ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.ip;

  if (ip) {
    try {
      if (loginRoute(request.nextUrl.pathname)) {
        await loginLimiter(`login-${ip}`);
      } else if (signupRoute(request.nextUrl.pathname)) {
        await signUpLimiter(`signup-${ip}`);
      } else if (clientSideApiRoute(request.nextUrl.pathname)) {
        await clientSideApiEndpointsLimiter(`client-side-api-${ip}`);

        const envIdAndUserId = isSyncWithUserIdentificationEndpoint(request.nextUrl.pathname);
        if (envIdAndUserId) {
          const { environmentId, userId } = envIdAndUserId;
          await syncUserIdentificationLimiter(`sync-${environmentId}-${userId}`);
        }
      } else if (shareUrlRoute(request.nextUrl.pathname)) {
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
    "/api/v1/users",
    "/api/(.*)/client/:path*",
    "/api/v1/js/actions",
    "/api/v1/client/storage",
    "/share/(.*)/:path",
    "/environments/:path*",
    "/setup/organization/:path*",
    "/api/auth/signout",
    "/auth/login",
    "/api/packages/:path*",
  ],
};
