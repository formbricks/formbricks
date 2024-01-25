import {
  clientSideApiEndpointsLimiter,
  loginLimiter,
  shareUrlLimiter,
  signUpLimiter,
} from "@/app/middleware/bucket";
import {
  clientSideApiRoute,
  loginRoute,
  shareUrlRoute,
  signupRoute,
} from "@/app/middleware/endpointValidator";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { WEBAPP_URL } from "@formbricks/lib/constants";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  if (token && callbackUrl) {
    return NextResponse.redirect(WEBAPP_URL + callbackUrl);
  }

  if (process.env.NODE_ENV !== "production") {
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
      } else if (shareUrlRoute(request.nextUrl.pathname)) {
        await shareUrlLimiter.check(ip);
      }
      return res;
    } catch (_e) {
      console.log("Rate Limiting IP: ", ip);

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
    "/auth/login",
  ],
};
