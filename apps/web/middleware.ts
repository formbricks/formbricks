import {
  clientSideApiEndpointsLimiter,
  loginLimiter,
  shareUrlLimiter,
  signUpLimiter,
  syncUserIdentificationLimiter,
} from "@/app/middleware/bucket";
import {
  clientSideApiRoute,
  isSyncWithUserIdentificationEndpoint,
  isWebAppRoute,
  loginRoute,
  shareUrlRoute,
  signupRoute,
} from "@/app/middleware/endpointValidator";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { RATE_LIMITING_DISABLED, WEBAPP_URL } from "@formbricks/lib/constants";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (isWebAppRoute(request.nextUrl.pathname) && !token) {
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

  const res = NextResponse.next();
  let ip = request.ip ?? request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? null;
  }

  if (ip) {
    try {
      if (loginRoute(request.nextUrl.pathname)) {
        await loginLimiter.check(ip);
      } else if (signupRoute(request.nextUrl.pathname)) {
        await signUpLimiter.check(ip);
      } else if (clientSideApiRoute(request.nextUrl.pathname)) {
        await clientSideApiEndpointsLimiter.check(ip);

        const envIdAndUserId = isSyncWithUserIdentificationEndpoint(request.nextUrl.pathname);
        if (envIdAndUserId) {
          const { environmentId, userId } = envIdAndUserId;
          await syncUserIdentificationLimiter.check(`${environmentId}-${userId}`);
        }
      } else if (shareUrlRoute(request.nextUrl.pathname)) {
        await shareUrlLimiter.check(ip);
      }
      return res;
    } catch (_e) {
      console.log(`Rate Limiting IP: ${ip}`);

      return NextResponse.json({ error: "Too many requests, Please try after a while!" }, { status: 429 });
    }
  }
  return res;
}

export const config = {
  matcher: [
    "/api/auth/callback/credentials",
    "/api/v1/users",
    "/api/(.*)/client/:path*",
    "/api/v1/js/actions",
    "/api/v1/client/storage",
    "/share/(.*)/:path",
    "/environments/:path*",
    "/api/auth/signout",
    "/auth/login",
  ],
};
